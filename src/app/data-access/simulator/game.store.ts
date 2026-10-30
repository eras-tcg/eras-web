import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Client } from '@stomp/stompjs';
import { AuthService } from '@core/auth/auth.service';
import { EditModeService } from '@core/auth/edit-mode.service';
import { persistedFlag } from '@core/storage/persisted-flag';
import { applyLocalMove, deckWarnings, targetForViewer } from './game-rules';
import { rulesView } from './legal-actions';
import { CardSlot, DummyCard, GameLogEntry, GameState, PlayerState, PostGameChoice, ZoneName } from './simulator.model';

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
  /**
   * Why I am no longer in the room (taken out by its owner, or it closed). The board leaves on it and the lobby
   * shows it; it outlives disconnect() for that.
   */
  readonly removed = signal<string | null>(null);
  readonly revealed = signal<RevealedCard[]>([]);
  readonly targetedId = signal<string | null>(null);
  readonly targetingSourceId = signal<string | null>(null);
  /** Card chosen with "Hacer objetivo", waiting for its target to be clicked. */
  readonly pendingTargetSource = signal<string | null>(null);
  /** Card clicked on the board: it shows its legal actions. */
  readonly selectedId = signal<string | null>(null);
  /** Who acts now: whoever must answer the pending choice, else the player whose turn it is. */
  readonly actingId = computed(() => {
    const s = this.state();
    if (s?.status !== 'IN_PROGRESS') return null;
    return s.prompt?.playerId ?? s.currentTurnUserId ?? null;
  });
  /**
   * A test room (from the site's edit mode): its owner plays both sides alone, with the manual actions, test
   * cards and every hidden card shown.
   */
  readonly editorRoom = computed(() => !!this.state()?.editor);
  private readonly siteEditMode = inject(EditModeService);
  /**
   * Editor mode: the manual actions outside the rules (moving cards between zones, lives, drawing, gems,
   * attachments, strength…). On in a test room and while the site's edit mode (the navigation bar's switch) is on.
   */
  readonly editorMode = computed(() => this.editorRoom() || this.siteEditMode.active());
  /** Test room: the side being played (my own by default). */
  readonly seat = signal<string | null>(null);
  /** Test room: the side played follows whoever must act (a choice, else the turn). */
  readonly followActive = signal(true);
  /**
   * Editor mode: hidden cards (hands, lives, deck) are shown. On by default in a test room, off against a player
   * until turned on.
   */
  private readonly revealChoice = signal<boolean | null>(null);
  readonly revealHidden = computed(() => this.revealChoice() ?? this.editorRoom());
  readonly seeAll = computed(() => this.editorMode() && this.revealHidden());

  toggleRevealHidden(): void {
    this.revealChoice.set(!this.revealHidden());
  }

  /**
   * "Efectos opcionales apagados": the engine does not offer my optional triggered effects ("En Juego" ones still).
   * Remembered on the device and set on the server in every game I enter.
   */
  readonly optionalOff = persistedFlag('eras-sim-optional-off');
  /** The room and value last sent, so a slow echo does not send it again. */
  private optionalSent: string | null = null;

  toggleOptionalOff(): void {
    this.optionalOff.set(!this.optionalOff());
  }

  constructor() {
    // The server keeps it per game: what the device remembers is sent when they differ
    effect(() => {
      const mine = this.myState();
      const want = this.optionalOff();
      if (!mine || !!mine.skipOptional === want) return;
      const key = `${this.roomId()}|${mine.userId}|${want}`;
      if (this.optionalSent === key) return;
      this.optionalSent = key;
      untracked(() => this.send('SET_SKIP_OPTIONAL', { value: want }));
    });
  }
  /** For one action: the side it is done as (a test room's other side, from its zones' dialogs). */
  private actAsOnce: string | null = null;

  /** Cards that just reached your hand: they blink for a few seconds so they can be spotted. */
  readonly newInHand = signal<ReadonlySet<string>>(new Set());
  private handIds: Set<string> | null = null;
  /** Cards chosen so far in the open choice: marked on the board so they can be told apart. */
  readonly promptChosen = signal<ReadonlySet<string>>(new Set());
  readonly log = signal<LogLine[]>([]);
  readonly recentLog = signal<LogLine[]>([]);

  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  /** The side I play: myself, or in a test room the side chosen. */
  private readonly me = computed(() => (this.editorRoom() && this.seat()) || this.userId());
  /** Test room: both sides (mine first). */
  readonly sides = computed(() => {
    const players = Object.values(this.state()?.players ?? {});
    const own = this.userId();
    return [...players.filter((p) => p.userId === own), ...players.filter((p) => p.userId !== own)];
  });
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
  readonly isHost = computed(() => !!this.userId() && this.state()?.hostId === this.userId());
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
    this.removed.set(null);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      let reconnecting = false;
      this.client = new Client({
        brokerURL: wsUrl(),
        connectHeaders: { Authorization: `Bearer ${this.auth.token() ?? ''}` },
        reconnectDelay: 3000,
        onConnect: () => {
          clearTimeout(timeout);
          this.connected.set(true);
          this.client?.subscribe(`/topic/room/${roomId}`, (msg) => this.onMessage(msg.body));
          // The socket dropped and came back by itself: be in the room again and get its current state
          if (reconnecting) this.send('JOIN_ROOM', { username: this.auth.user()?.username ?? '' });
          reconnecting = true;
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
    this.seat.set(null);
    this.connected.set(false);
    this.error.set(null);
    this.deckWarning.set(null);
    this.revealed.set([]);
    this.log.set([]);
    this.recentLog.set([]);
    this.targetedId.set(null);
    this.pendingTargetSource.set(null);
  }

  /** Cards in your hand that were not there before (only while playing, not on joining or a new game). */
  private markNewInHand(update: GameState, me: string | null): void {
    const hand = (me && update.players?.[me]?.hand) || [];
    const ids = new Set(hand.map((c) => c.instanceId));
    const previous = this.handIds;
    this.handIds = ids;
    if (!previous || update.status !== 'IN_PROGRESS' || update.event === 'JOIN_ROOM' || update.event === 'RECONNECT') return;
    const added = [...ids].filter((id) => !previous.has(id));
    if (!added.length) return;
    this.newInHand.update((s) => new Set([...s, ...added]));
    this.later(4000, () => this.newInHand.update((s) => new Set([...s].filter((id) => !added.includes(id)))));
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
    const me = this.userId();
    if (update.error) {
      // The room is gone (closed while I was away)
      if (update.error === 'La sala ya no existe' && (!update.actorId || update.actorId === me)) {
        this.removed.set('La sala se cerró');
        return;
      }
      // Errors reach the whole room: show only the ones caused by this player
      if (!update.actorId || update.actorId === me) this.error.set(update.error);
      return;
    }
    // Taken out of the room: stop showing it
    const wasIn = !!me && !!this.state()?.players?.[me];
    if (me && wasIn && !update.players?.[me]) {
      this.removed.set(update.event === 'PLAYER_KICKED' && update.subjectUserId === me ? 'El dueño de la sala te sacó de la sala' : 'Ya no estás en la sala');
      return;
    }
    const previous = this.state();
    this.state.set(update);
    this.error.set(null);
    if (update.editor) this.followSides(update, previous);
    this.markNewInHand(update, this.me());

    // Warn about the deck I just picked (in the pre-room I join without one)
    const side = this.me();
    if (update.event === 'SET_DECK' && side && update.actorId === side) {
      const warnings = deckWarnings(update.players?.[side]?.originalDeck ?? []);
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
      this.targetedId.set(targetForViewer(update.targetedInstanceId, update.actorId === this.me()));
      this.targetingSourceId.set(update.targetingSourceInstanceId ?? null);
      this.later(3000, () => {
        this.targetedId.set(null);
        this.targetingSourceId.set(null);
      });
    }
  }

  /**
   * Test room: the side played follows whoever must act now — the player a choice waits for; in the mulligan,
   * the side that has not confirmed yet; else the one whose turn it is when the turn (or the game's phase)
   * changes or a choice ends.
   */
  private followSides(update: GameState, previous: GameState | null): void {
    if (!this.followActive()) return;
    const ids = Object.keys(update.players ?? {});
    const confirmed = update.mulliganReady ?? [];
    const next =
      update.prompt?.playerId ??
      (update.status === 'MULLIGAN' ? ids.find((id) => !confirmed.includes(id)) : null) ??
      (update.currentTurnUserId !== previous?.currentTurnUserId || update.status !== previous?.status || previous?.prompt ? update.currentTurnUserId : null);
    if (next && update.players?.[next]) this.seat.set(next);
  }

  /** Test room: plays the given side from now on. */
  playSide(userId: string): void {
    this.seat.set(userId);
  }

  /** Test room: runs actions as the given side (its zones seen from the other side). */
  actingAs(userId: string | null, actions: () => void): void {
    this.actAsOnce = userId;
    try {
      actions();
    } finally {
      this.actAsOnce = null;
    }
  }

  /** The side an action is done as. */
  private actor(): string | null {
    return this.actAsOnce ?? this.me();
  }

  private send(type: string, payload: Record<string, unknown> = {}): void {
    const room = this.roomId();
    if (!this.client?.connected || !room) return;
    // Test room: the owner plays the other side too
    const actor = this.actor();
    const body = this.editorRoom() && actor && actor !== this.userId() ? { ...payload, actAs: actor } : payload;
    this.client.publish({ destination: `/app/room/${room}/action`, body: JSON.stringify({ type, payload: body }) });
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

  /**
   * Ritual summon from the hand: the server checks the special cost and the Requerimiento. `summonerId` is the
   * creature it was dropped onto; whatever is missing is asked with a prompt.
   */
  ritualSummon(instanceId: string, summonerId: string | null = null): void {
    this.send('RITUAL_SUMMON', { instanceId, summonerId });
  }

  /** Activates a slow effect (listed in `state.activatable`). */
  activateEffect(instanceId: string, scriptId: string | null = null): void {
    this.send('ACTIVATE_EFFECT', { instanceId, scriptId });
  }

  /** Sacrifices one of your cards on the field: destroyed, to your Tributos. */
  sacrificeCard(instanceId: string): void {
    this.send('SACRIFICE_CARD', { instanceId });
  }

  /** Answers the effect choice the engine waits for. `order`: the cards not chosen, in deck-bottom order. */
  resolvePrompt(promptId: string, chosen: string[], order: string[] = []): void {
    // Test room: answered as the side it is for
    const prompt = this.state()?.prompt;
    this.actingAs(this.editorRoom() && prompt?.id === promptId ? prompt.playerId : this.actAsOnce, () =>
      this.send('RESOLVE_PROMPT', { promptId, chosen, order }),
    );
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
  enterEndPhase(): void {
    this.send('ENTER_END_PHASE');
  }
  endTurn(): void {
    this.send('END_TURN');
  }
  startGame(firstPlayerId: string): void {
    this.send('START_GAME', { firstPlayerId });
  }
  /** Pre-room: the deck to play with (its first Iniciador is the starter until another is chosen). */
  setDeck(deckId: string): void {
    this.send('SET_DECK', { deckId });
  }
  setStarter(cardId: string): void {
    this.send('SET_STARTER', { cardId });
  }
  /** Pre-room (host): who takes the first turn, a player id or "random". */
  setFirstPlayer(choice: string): void {
    this.send('SET_FIRST_PLAYER', { choice });
  }
  setReady(ready: boolean): void {
    this.send('SET_READY', { ready });
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
  /** Leaves the room for good (the seat is freed; an owner passes the room on, an empty room closes). */
  leaveRoom(): void {
    this.send('LEAVE_ROOM');
  }
  /** The owner takes a player out of the room (in a game, only a disconnected one). */
  kickPlayer(userId: string): void {
    this.send('KICK_PLAYER', { userId });
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
  /** Several cards from one zone to another in one action (one update, one line of history). */
  bulkMove(
    instanceIds: string[],
    fromZone: ZoneName,
    toZone: ZoneName,
    opts: { toPosition?: 'top' | 'bottom'; targetPlayerId?: string | null; faceDown?: boolean } = {},
  ): void {
    if (!instanceIds.length) return;
    const { toPosition, targetPlayerId = null, faceDown } = opts;
    const me = this.me();
    const state = this.state();
    if (!targetPlayerId && me && this.actor() === me && state?.players?.[me]) {
      const moved = instanceIds.reduce((p, id) => applyLocalMove(p, id, fromZone, toZone), state.players[me]);
      if (moved !== state.players[me]) this.state.set({ ...state, players: { ...state.players, [me]: moved } });
    }
    this.send('BULK_MOVE', { instanceIds, fromZone, toZone, toPosition, targetPlayerId, ...(faceDown != null ? { faceDown } : {}) });
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
    if (!targetPlayerId && me && this.actor() === me && state?.players?.[me]) {
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
  /** Test room: a made-up card (or a copy of a real one) placed in a zone of the side being played. */
  createDummy(card: DummyCard): void {
    this.send('CREATE_DUMMY', { ...card });
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
