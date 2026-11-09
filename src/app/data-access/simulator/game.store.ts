import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { EditModeService } from '@core/auth/edit-mode.service';
import { persistedFlag } from '@core/storage/persisted-flag';
import { Deck } from '../decks/deck.model';
import { LOCAL_ROOM_ID, LocalMatchConfig } from './engine-protocol';
import { GameTransport, TransportEvents } from './game-transport';
import { GameTransports } from './game-transports';
import { applyLocalMove } from './game-rules';
import { GameNotices } from './game-notices';
import { rulesView } from './legal-actions';
import { BotLevel, CardSlot, DummyCard, GameState, PlayerState, PostGameChoice, ZoneName } from './simulator.model';
import { Prelude, UpdateQueue, isTimeJump } from './update-queue';

/** The bot's seat in a room against it. */
const BOT_SEAT = 'bot';
/** What a replay's viewer sends: entering, leaving and the time line. */
const REPLAY_ACTIONS = new Set(['JOIN_ROOM', 'LEAVE_ROOM', 'TIME_STEP']);

/**
 * Live game room: over STOMP (/user/queue/room/{id} in: this player's own view; /app/room/{id}/action out), or, in
 * Modo solo sin conexión, the engine in a Web Worker speaking the same protocol (see GameTransport).
 * Every broadcast carries the full state; this store keeps it, shows the updates in line (UpdateQueue) and keeps
 * their transient notices (GameNotices: revealed cards, targeting glow, recent log lines). Same protocol as the
 * legacy app.
 */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly auth = inject(AuthService);
  private readonly transports = inject(GameTransports);
  /** How the room is reached: the server (STOMP) or the engine in this browser. */
  private transport: GameTransport | null = null;

  readonly roomId = signal<string | null>(null);
  readonly connected = signal(false);
  readonly state = signal<GameState | null>(null);
  readonly error = signal<string | null>(null);
  /**
   * Modo solo sin conexión: the room is a game against the bot run by the engine in this browser (room "local"). What
   * only the server has is not there: manual actions, ranked, missions, the match history, reconnections.
   */
  readonly local = signal(false);
  /** Modo solo sin conexión: the decks the game can be played with (the starter decks and the player's own, as loaded). */
  readonly localDecks = signal<Deck[]>([]);
  /** The transient notices of the updates shown (forwarded below). */
  private readonly notices = new GameNotices();
  readonly deckWarning = this.notices.deckWarning;
  /**
   * Why I am no longer in the room (taken out by its owner, or it closed). The board leaves on it and the lobby
   * shows it; it outlives disconnect() for that.
   */
  readonly removed = signal<string | null>(null);
  readonly revealed = this.notices.revealed;
  readonly targetedId = this.notices.targetedId;
  readonly targetingSourceId = this.notices.targetingSourceId;
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
  /** A room against the server's bot: played as an online game, but its owner picks the bot's deck and nobody else enters. */
  readonly botRoom = computed(() => !!this.state()?.bot);
  /** A ranked game: its result moves the rank; who goes first is drawn, and against the bot its level and deck are not chosen. */
  readonly rankedRoom = computed(() => !!this.state()?.ranked);
  /** A room of the ranked queue (Online): for the two players paired, always ranked, nobody else enters. */
  readonly queuedRoom = computed(() => !!this.state()?.queued);
  /** The updates in line (see UpdateQueue). */
  private readonly updates = new UpdateQueue(
    () => this.state(),
    (update) => this.apply(update),
  );
  /** The table jumped through time: shown as it is, without animating each move in between (see UpdateQueue). */
  readonly jumped = this.updates.jumped;
  /** While the board plays an animation, the updates that arrive wait in line (see UpdateQueue). Errors are shown at once. */
  readonly holdUpdates = this.updates.hold;
  /** A replay of a kept game: read only, watched move by move (the time line's controls). */
  readonly replayRoom = computed(() => !!this.state()?.replay);
  /** The simulator's administrators (simulator_admin) may have a bot play their own side in the Sala de pruebas. */
  readonly simulatorAdmin = computed(() => !!this.auth.user() && this.auth.can('simulator_admin'));
  /** Sala de pruebas or Modo solo: the room is its owner's alone, started from "Jugar". */
  readonly ownRoom = computed(() => this.editorRoom() || this.botRoom());
  private readonly siteEditMode = inject(EditModeService);
  /**
   * Editor mode: the manual actions outside the rules (moving cards between zones, lives, drawing, gems,
   * attachments, strength…). On in a test room (also without the connection: its games count for nothing) and while
   * the site's edit mode (the navigation bar's switch) is on, never in an offline game against the bot.
   */
  readonly editorMode = computed(() => this.editorRoom() || (!this.local() && this.siteEditMode.active()));
  /** Test room: the side being played (my own by default). */
  readonly seat = signal<string | null>(null);
  /** Test room: the side played follows whoever must act (a choice, else the turn). */
  readonly followActive = signal(true);
  /**
   * Editor mode: hidden cards (hands, lives, deck) are shown. On by default in a test room, off against a player
   * until turned on.
   */
  private readonly revealChoice = signal<boolean | null>(null);
  readonly revealHidden = computed(() => this.revealChoice() ?? (this.editorRoom() || this.replayRoom()));
  /** Every hidden card in view: a test room (by choice) or a replay (the game is over). */
  readonly seeAll = computed(() => this.replayRoom() || (this.editorMode() && this.revealHidden()));

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

  /**
   * "Información", while its button is held: the table shows more about the cards and zones in sight (cost, type,
   * classes and level of the cards on the field; how many cards each pile, line and hand holds).
   */
  readonly showInfo = signal(false);

  constructor() {
    // The board let go: show what waited (a frame later, so animations that start now hold it again)
    effect(() => {
      if (!this.holdUpdates()) untracked(() => requestAnimationFrame(() => this.drain()));
    });
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
  readonly newInHand = this.notices.newInHand;
  /** Cards chosen so far in the open choice: marked on the board so they can be told apart. */
  readonly promptChosen = signal<ReadonlySet<string>>(new Set());
  readonly log = this.notices.log;
  readonly recentLog = this.notices.recentLog;

  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  /** The side I play: myself, or in a test room the side chosen. */
  private readonly me = computed(() => {
    const s = this.state();
    if ((this.editorRoom() || this.replayRoom()) && this.seat()) return this.seat();
    // A replay of a game the viewer did not play: seen from its first seat
    if (s?.replay && !s.players?.[this.userId() ?? '']) return Object.keys(s.players ?? {})[0] ?? this.userId();
    return this.userId();
  });
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
  /**
   * The side shown is not the player's to decide: a bot plays it (Sala de pruebas: the rival's with "El bot juega el
   * lado del rival", the owner's with "Un bot juega tu lado") or the room is a replay. Its choices and mulligan are
   * then the bot's: never a dialog over the board.
   */
  readonly sideByBot = computed(() => {
    const s = this.state();
    const id = this.me();
    if (!s || !id) return false;
    if (s.replay) return true;
    if (!s.editor) return false;
    return id === s.hostId ? !!s.editorSelfBot : !!s.editorBot;
  });
  /**
   * The choice just answered: its dialog goes at once, while the table still plays what came before the answer (the
   * update that clears it may wait for those animations). Forgotten if the server refuses the answer.
   */
  private readonly answered = signal<string | null>(null);
  /** Effect choice waiting for this player (blocking modal); none when a bot answers it (see sideByBot) or once answered. */
  readonly myPrompt = computed(() => {
    const prompt = this.state()?.prompt;
    return prompt && prompt.playerId === this.me() && !this.sideByBot() && prompt.id !== this.answered() ? prompt : null;
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
    if (this.transport?.isOpen && this.roomId() === roomId && this.connected()) return Promise.resolve();
    // The offline game's room is only reached from "Jugar" (connectLocal): a link to it opens nothing
    if (roomId === LOCAL_ROOM_ID) return Promise.reject(new Error('La partida sin conexión ya terminó'));
    return this.open(roomId, this.transports.stomp(timeoutMs));
  }

  /**
   * Modo solo sin conexión: a game against the bot in this browser, with the given decks (`config.decks`; `decks`, the
   * same as the pre-room lists them). Resolves once the engine has made the room; then it is played as online.
   */
  connectLocal(config: LocalMatchConfig, decks: Deck[]): Promise<void> {
    const opened = this.open(config.roomId ?? LOCAL_ROOM_ID, this.transports.local(config));
    this.localDecks.set(decks);
    return opened;
  }

  private open(roomId: string, transport: GameTransport): Promise<void> {
    this.disconnect();
    this.transport = transport;
    this.local.set(transport.local);
    this.roomId.set(roomId);
    this.removed.set(null);
    // What a transport replaced (or closed) still says is not this room's
    const current = () => this.transport === transport;
    const events: TransportEvents = {
      message: (body) => current() && this.onMessage(body),
      connected: (again) => {
        if (!current()) return;
        this.connected.set(true);
        // The socket dropped and came back by itself: be in the room again and get its current state
        if (again) this.send('JOIN_ROOM', { username: this.auth.user()?.username ?? '' });
      },
      disconnected: () => current() && this.connected.set(false),
      failed: (message) => {
        if (!current()) return;
        this.error.set(message);
        this.connected.set(false);
      },
    };
    return transport.open(roomId, events);
  }

  disconnect(): void {
    this.transport?.close();
    this.transport = null;
    this.local.set(false);
    this.notices.clear();
    this.roomId.set(null);
    this.state.set(null);
    this.updates.clear();
    this.seat.set(null);
    this.connected.set(false);
    this.error.set(null);
    this.pendingTargetSource.set(null);
  }

  /** The board's prelude to each update (see UpdateQueue); null when the board goes. */
  setPrelude(prelude: Prelude | null): void {
    this.updates.prelude = prelude;
  }

  // The queue's parts under their former names, for debugging from the browser (g['incoming'].push(x); g['drain']())
  private get incoming(): GameState[] {
    return this.updates.incoming;
  }
  private get draining(): boolean {
    return this.updates.draining;
  }
  private get prelude(): Prelude | null {
    return this.updates.prelude;
  }
  private drain(): void {
    this.updates.drain();
  }

  private onMessage(body: string): void {
    const update = JSON.parse(body) as GameState;
    if (update.error) {
      this.apply(update);
      return;
    }
    this.incoming.push(update);
    this.drain();
  }

  private apply(update: GameState): void {
    const me = this.userId();
    if (update.error) {
      // The room is gone (closed while I was away)
      if (update.error === 'La sala ya no existe' && (!update.actorId || update.actorId === me)) {
        this.removed.set('La sala se cerró');
        return;
      }
      // Errors reach the whole room: show only the ones caused by this player (a refused answer: its choice again)
      if (!update.actorId || update.actorId === me) {
        this.error.set(update.error);
        this.answered.set(null);
      }
      return;
    }
    // Taken out of the room: stop showing it
    const wasIn = !!me && !!this.state()?.players?.[me];
    if (me && wasIn && !update.players?.[me]) {
      this.removed.set(update.event === 'PLAYER_KICKED' && update.subjectUserId === me ? 'El dueño de la sala te sacó de la sala' : 'Ya no estás en la sala');
      return;
    }
    const previous = this.state();
    // A jump through time (more than one move at once) is shown without animating what lies in between
    this.jumped.set(isTimeJump(previous?.timelineAt, update));
    this.state.set(update);
    this.error.set(null);
    if (update.editor) this.followSides(update, previous);
    this.notices.take(update, this.me());
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
    // With the bot playing the rival, the owner stays on their own side: the bot's decisions are not theirs to take
    if (update.editorBot && next !== update.hostId) return;
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
    if (!this.transport?.isOpen || !room) return;
    // A replay is only watched: nothing of the game is sent
    if (this.replayRoom() && !REPLAY_ACTIONS.has(type)) return;
    // Test room: the owner plays the other side too
    const actor = this.actor();
    const body = this.editorRoom() && actor && actor !== this.userId() ? { ...payload, actAs: actor } : payload;
    this.transport.publish(room, JSON.stringify({ type, payload: body }));
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
    this.answered.set(promptId);
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
  /** Pre-room: the deck to play with (its first Iniciador is the starter until another is chosen); `forBot`: the bot's. */
  setDeck(deckId: string, forBot = false): void {
    this.send('SET_DECK', forBot ? { deckId, actAs: BOT_SEAT } : { deckId });
  }
  /** Sala de pruebas: the bots wait (true) or play again (false). */
  setPaused(paused: boolean): void {
    this.send('SET_PAUSED', { paused });
  }
  /** Sala de pruebas: through the time line, `by` moves back (negative) or forth, or to the move `to`. */
  timeStep(step: { by: number } | { to: number }): void {
    this.send('TIME_STEP', step);
  }
  /** Pre-room, owner only: the game is ranked (true) or friendly (false). */
  setRanked(ranked: boolean): void {
    this.send('SET_RANKED', { ranked });
  }
  /** Sala de pruebas: the bot plays the test rival's side (true) or the owner does by hand (false). */
  setEditorBot(on: boolean): void {
    this.send('SET_EDITOR_BOT', { on });
  }
  /** Sala de pruebas (simulator administrators): a bot plays the owner's own side too (true) or the owner does by hand (false). */
  setEditorSelfBot(on: boolean): void {
    this.send('SET_EDITOR_SELF_BOT', { on });
  }
  /** Sala de pruebas: the level or model of the bot that plays the owner's side. */
  setSelfBotLevel(level: BotLevel): void {
    this.send('SET_BOT_LEVEL', { level, side: 'self' });
  }
  /** The pause before each move of the room's bots, in ms (null: each bot's own pace). */
  /** Sala de pruebas: the edge of the rival's side (0–8), from its next turn on. */
  setBotEdge(level: number): void {
    this.send('SET_BOT_EDGE', { level });
  }

  setBotDelay(ms: number | null): void {
    this.send('SET_BOT_DELAY', { ms: ms ?? -1 });
    // The server takes it at once but sends no update for it (a bot may be thinking): shown now, the next update has it
    this.state.update((s) => (s ? { ...s, botDelayMs: ms } : s));
  }
  /** Pre-room of a room against the bot: how well it plays (the owner chooses). */
  setBotLevel(level: BotLevel): void {
    this.send('SET_BOT_LEVEL', { level });
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
