import { Injectable, computed, inject, signal } from '@angular/core';
import { Client } from '@stomp/stompjs';
import { AuthService } from '@core/auth/auth.service';
import { applyLocalMove, deckWarnings, targetForViewer } from './game-rules';
import { rulesView } from './legal-actions';
import { CardSlot, GameLogEntry, GameState, PlayerState, PostGameChoice, ZoneName } from './simulator.model';

export interface RevealedCard {
  id: number;
  imageUrl: string;
  name: string | null;
}

export interface LogLine extends GameLogEntry {
  id: string;
}

/** Same-origin WebSocket: nginx (and the dev proxy) forward /ws to DriveManager. */
function wsUrl(): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
}

/**
 * Live game room over STOMP (/topic/room/{id} in, /app/room/{id}/action out).
 * Every broadcast carries the full state; this store keeps it plus the transient effects
 * (revealed cards, targeting glow, recent log lines). Same protocol as the legacy app.
 */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly auth = inject(AuthService);
  private client: Client | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  readonly roomId = signal<string | null>(null);
  readonly connected = signal(false);
  readonly state = signal<GameState | null>(null);
  readonly error = signal<string | null>(null);
  readonly deckWarning = signal<string | null>(null);
  readonly revealed = signal<RevealedCard[]>([]);
  readonly targetedId = signal<string | null>(null);
  readonly targetingSourceId = signal<string | null>(null);
  /** Card chosen with "Hacer objetivo", waiting for its target to be clicked. */
  readonly pendingTargetSource = signal<string | null>(null);
  /** Card clicked on the board: it shows its legal actions. */
  readonly selectedId = signal<string | null>(null);
  readonly log = signal<LogLine[]>([]);
  readonly recentLog = signal<LogLine[]>([]);

  private readonly me = computed(() => this.auth.user()?.id ?? null);
  readonly myState = computed<PlayerState | null>(() => {
    const id = this.me();
    return (id && this.state()?.players?.[id]) || null;
  });
  readonly opponentState = computed<PlayerState | null>(() => {
    const players = this.state()?.players;
    return players ? (Object.values(players).find((p) => p.userId !== this.me()) ?? null) : null;
  });
  readonly status = computed(() => this.state()?.status ?? null);
  readonly phase = computed(() => this.state()?.currentPhase ?? 'MAIN');
  readonly isMyTurn = computed(() => !!this.me() && this.state()?.currentTurnUserId === this.me());
  /** Effect choice waiting for this player (blocking modal). */
  readonly myPrompt = computed(() => {
    const prompt = this.state()?.prompt;
    return prompt && prompt.playerId === this.me() ? prompt : null;
  });
  /** Effect being resolved, when the rules engine is busy (shown to both players). */
  readonly resolving = computed(() => {
    const chain = this.state()?.chain;
    return chain?.length ? chain[chain.length - 1] : null;
  });
  /** What the rules check for me now (turn, phase, closed state, gems). */
  readonly rules = computed(() => rulesView(this.state(), this.me()));
  readonly isHost = computed(() => !!this.me() && this.state()?.hostId === this.me());
  /** The player listed first sees the shared bar unmirrored. */
  readonly isFirstPlayer = computed(() => {
    const ids = Object.keys(this.state()?.players ?? {});
    return ids.length === 0 || ids[0] === this.me();
  });
  readonly postGameChoices = computed(() => this.state()?.postGameChoices ?? {});

  /** Opens the socket for a room (no-op when already connected to it). Resolves once STOMP is connected. */
  connect(roomId: string, timeoutMs = 8000): Promise<void> {
    if (this.client?.active && this.roomId() === roomId && this.connected()) return Promise.resolve();
    this.disconnect();
    this.roomId.set(roomId);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      this.client = new Client({
        brokerURL: wsUrl(),
        connectHeaders: { Authorization: `Bearer ${this.auth.token() ?? ''}` },
        reconnectDelay: 3000,
        onConnect: () => {
          clearTimeout(timeout);
          this.connected.set(true);
          this.client?.subscribe(`/topic/room/${roomId}`, (msg) => this.onMessage(msg.body));
          resolve();
        },
        onStompError: (frame) => {
          this.error.set(frame.headers['message'] ?? 'Error de conexión con la sala');
          this.connected.set(false);
        },
        onWebSocketClose: () => this.connected.set(false),
        onDisconnect: () => this.connected.set(false),
      });
      this.client.activate();
    });
  }

  disconnect(): void {
    void this.client?.deactivate();
    this.client = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.roomId.set(null);
    this.state.set(null);
    this.connected.set(false);
    this.error.set(null);
    this.deckWarning.set(null);
    this.revealed.set([]);
    this.log.set([]);
    this.recentLog.set([]);
    this.targetedId.set(null);
    this.pendingTargetSource.set(null);
  }

  private later(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private onMessage(body: string): void {
    const update = JSON.parse(body) as GameState;
    if (update.error) {
      // Errors reach the whole room: show only the ones caused by this player
      if (!update.actorId || update.actorId === this.me()) this.error.set(update.error);
      return;
    }
    this.state.set(update);
    this.error.set(null);
    const me = this.me();

    if (update.event === 'JOIN_ROOM' && me) {
      const warnings = deckWarnings(update.players?.[me]?.originalDeck ?? []);
      if (warnings.length) {
        this.deckWarning.set(warnings.join(' · '));
        this.later(10_000, () => this.deckWarning.set(null));
      }
    }

    if (update.event === 'REVEAL_TO_HAND' && update.revealedCardImageUrl) {
      const card: RevealedCard = { id: Date.now() + Math.random(), imageUrl: update.revealedCardImageUrl, name: update.revealedCardName ?? null };
      this.revealed.update((list) => [...list, card]);
      this.later(3000, () => this.revealed.update((list) => list.filter((c) => c.id !== card.id)));
    }

    if (Array.isArray(update.eventLog)) {
      const previous = this.log().length;
      const lines = update.eventLog.map((e, i) => ({ ...e, id: `${e.ts}_${i}` }));
      this.log.set(lines);
      // Joining replays the whole history: only flash lines that are new while playing
      if (update.event !== 'JOIN_ROOM' && update.event !== 'RECONNECT') {
        for (const line of lines.slice(previous)) {
          this.recentLog.update((list) => [...list, line]);
          this.later(6000, () => this.recentLog.update((list) => list.filter((l) => l.id !== line.id)));
        }
      }
    }

    if (update.event === 'TARGET_CARD' && update.targetedInstanceId) {
      this.targetedId.set(targetForViewer(update.targetedInstanceId, update.actorId === me));
      this.targetingSourceId.set(update.targetingSourceInstanceId ?? null);
      this.later(3000, () => {
        this.targetedId.set(null);
        this.targetingSourceId.set(null);
      });
    }
  }

  private send(type: string, payload: Record<string, unknown> = {}): void {
    const room = this.roomId();
    if (!this.client?.connected || !room) return;
    this.client.publish({ destination: `/app/room/${room}/action`, body: JSON.stringify({ type, payload }) });
  }

  // ── Actions (same names and payloads as the legacy store) ──────────────

  /** Normal summon (rules engine): a creature from the hand to the board; the server pays its cost and fires its triggers. */
  normalSummon(instanceId: string, x: number, y: number): void {
    this.send('NORMAL_SUMMON', { instanceId, x, y });
  }

  /** Destroys a card on the field: to its owner's Descarte; its "En Destrucción" effects trigger. */
  destroyCard(instanceId: string, targetPlayerId: string | null = null): void {
    this.send('DESTROY_CARD', { instanceId, targetPlayerId });
  }

  /** Declares an attack with one of your creatures; `targetInstanceId` null attacks the opponent. */
  attack(instanceId: string, targetInstanceId: string | null = null): void {
    this.send('ATTACK', { instanceId, targetInstanceId });
  }

  /** Plays a utility or structure from the hand: the server pays it and fires its "En Juego" effects. */
  playCard(instanceId: string, x: number, y: number): void {
    this.send('PLAY_CARD', { instanceId, x, y });
  }

  /** Sacrifices one of your cards on the field: destroyed, to your Tributos. */
  sacrificeCard(instanceId: string): void {
    this.send('SACRIFICE_CARD', { instanceId });
  }

  /** Answers the effect choice the engine waits for. `order`: the cards not chosen, in deck-bottom order. */
  resolvePrompt(promptId: string, chosen: string[], order: string[] = []): void {
    this.send('RESOLVE_PROMPT', { promptId, chosen, order });
  }

  joinRoom(deckId: string | null): void {
    this.send('JOIN_ROOM', { deckId, username: this.auth.user()?.username ?? '' });
  }
  drawCard(): void {
    this.send('DRAW_CARD');
  }
  shuffleDeck(): void {
    this.send('SHUFFLE_DECK');
  }
  passTurn(): void {
    this.send('PASS_TURN');
  }
  enterEndPhase(): void {
    this.send('ENTER_END_PHASE');
  }
  endTurn(): void {
    this.send('END_TURN');
  }
  startGame(firstPlayerId: string): void {
    this.send('START_GAME', { firstPlayerId });
  }
  selectStarter(instanceId: string): void {
    this.send('SELECT_STARTER', { instanceId });
  }
  confirmMulligan(toBottom: string[]): void {
    this.send('CONFIRM_MULLIGAN', { toBottom });
  }
  surrender(): void {
    this.send('SURRENDER');
  }
  postGameChoice(choice: PostGameChoice): void {
    this.send('POST_GAME_CHOICE', { choice });
  }
  setMarker(value: number): void {
    this.send('SET_MARKER', { value });
  }
  setCounter(value: number): void {
    this.send('SET_COUNTER', { value });
  }
  closeRoom(): void {
    this.send('CLOSE_ROOM');
  }
  resolveEffectSummon(instanceId: string, fromZone: ZoneName, draw: boolean): void {
    this.send('EFFECT_SUMMON_RESOLVE', { instanceId, fromZone, draw });
  }
  viewDeck(position: 'top' | 'bottom', n: number): void {
    this.send('VIEW_DECK', { position, n });
  }
  viewLifeStack(): void {
    this.send('VIEW_LIFE_STACK');
  }
  viewLifeCard(instanceId: string): void {
    this.send('VIEW_LIFE_CARD', { instanceId });
  }
  bulkToDeckBottom(zone: ZoneName, instanceIds: string[], random: boolean): void {
    this.send('BULK_TO_DECK_BOTTOM', { zone, instanceIds, random });
  }

  moveCard(
    instanceId: string,
    fromZone: ZoneName,
    toZone: ZoneName,
    opts: { x?: number; y?: number; toPosition?: 'top' | 'bottom'; targetPlayerId?: string | null; faceDown?: boolean } = {},
  ): void {
    const { x, y, toPosition, targetPlayerId = null, faceDown } = opts;
    // Own cards move immediately; the broadcast confirms it a moment later
    const me = this.me();
    const state = this.state();
    if (!targetPlayerId && me && state?.players?.[me]) {
      const moved = applyLocalMove(state.players[me], instanceId, fromZone, toZone, x, y);
      if (moved !== state.players[me]) this.state.set({ ...state, players: { ...state.players, [me]: moved } });
    }
    this.send('MOVE_CARD', { instanceId, fromZone, toZone, x, y, toPosition, targetPlayerId, ...(faceDown != null ? { faceDown } : {}) });
  }
  flipCard(instanceId: string, zone: ZoneName): void {
    this.send('FLIP_CARD', { instanceId, zone });
  }
  tapCard(instanceId: string, zone: ZoneName, targetPlayerId: string | null = null): void {
    this.send('TAP_CARD', { instanceId, zone, targetPlayerId });
  }
  modifyStrength(instanceId: string, delta: number, targetPlayerId: string | null = null): void {
    this.send('MODIFY_STRENGTH', { instanceId, delta, targetPlayerId });
  }
  removeCard(instanceId: string, zone: ZoneName, targetPlayerId: string | null = null): void {
    this.send('REMOVE_CARD', { instanceId, zone, targetPlayerId });
  }
  restoreCard(slot: CardSlot): void {
    const { instanceId, cardId, imageUrl, cardName, cardType, strength, specialSummonKind } = slot;
    this.send('RESTORE_CARD', { instanceId, cardId, imageUrl, cardName, cardType, strength, specialSummonKind });
    this.send('TARGET_CARD', { targetInstanceId: instanceId, sourceInstanceId: null });
  }
  refreshCardMetadata(cardId: string): void {
    this.send('REFRESH_CARD_METADATA', { cardId });
  }

  lifeHeal(): void {
    this.send('LIFE_HEAL');
  }
  lifeShuffle(): void {
    this.send('LIFE_SHUFFLE');
  }
  lifeAllDown(): void {
    this.send('LIFE_ALL_DOWN');
  }
  lifeAllUp(): void {
    this.send('LIFE_ALL_UP');
  }
  lifeRestart(): void {
    this.send('LIFE_RESTART');
  }
  deckReorderTop(instanceIds: string[], position: 'top' | 'bottom', shuffle: boolean): void {
    this.send('DECK_REORDER_TOP', { instanceIds, position, shuffle });
  }
  zoneReorder(zone: ZoneName, instanceIds: string[]): void {
    this.send('ZONE_REORDER', { zone, instanceIds });
  }
  deckIncludeDiscard(): void {
    this.send('DECK_INCLUDE_DISCARD');
  }
  deckIncludeTribute(): void {
    this.send('DECK_INCLUDE_TRIBUTE');
  }

  addMaterial(instanceId: string, fromZone: ZoneName, targetInstanceId: string, attachmentChoice: string | null = null): void {
    this.send('ADD_MATERIAL', { instanceId, fromZone, targetInstanceId, attachmentChoice });
  }
  addResource(instanceId: string, fromZone: ZoneName, targetInstanceId: string): void {
    this.send('ADD_RESOURCE', { instanceId, fromZone, targetInstanceId });
  }
  specialSummon(summonedId: string, fromZone: ZoneName, summonerId: string, summonType: string): void {
    this.send('SPECIAL_SUMMON', { summonedId, fromZone, summonerId, summonType });
  }
  moveFromAttachment(p: {
    instanceId: string;
    attachmentOf: string;
    attachmentType: 'materials' | 'resources';
    toZone: ZoneName;
    faceDown?: boolean;
    position?: 'top' | 'bottom';
    targetPlayerId?: string | null;
  }): void {
    this.send('MOVE_FROM_ATTACHMENT', { faceDown: false, position: 'bottom', targetPlayerId: null, ...p });
  }
  swapWithMain(instanceId: string, attachmentType: 'materials' | 'resources', parentId: string, targetPlayerId: string | null = null): void {
    this.send('SWAP_WITH_MAIN', { instanceId, attachmentType, parentId, targetPlayerId });
  }
  reclassifyAttachment(instanceId: string, fromType: 'materials' | 'resources', parentId: string, targetPlayerId: string | null = null): void {
    this.send('RECLASSIFY_ATTACHMENT', { instanceId, fromType, parentId, targetPlayerId });
  }
  reorderAttachment(parentId: string, attachmentType: 'materials' | 'resources', instanceIds: string[], targetPlayerId: string | null = null): void {
    this.send('REORDER_ATTACHMENT', { parentId, attachmentType, instanceIds, targetPlayerId });
  }
  revealToHand(instanceId: string): void {
    this.send('REVEAL_TO_HAND', { instanceId });
  }

  /** Targets a card or zone with the card picked through "Hacer objetivo" (or none). */
  target(targetInstanceId: string, sourceInstanceId: string | null = this.pendingTargetSource()): void {
    this.pendingTargetSource.set(null);
    this.send('TARGET_CARD', { targetInstanceId, sourceInstanceId });
  }
}
