import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, effect, inject, output, signal, untracked, viewChild } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { Mission, MissionBoard } from '@core/missions/mission.model';
import { MissionsStore } from '@core/missions/missions.store';
import { missionText } from '@data/missions/mission-rules';
import { POST_GAME_LABELS, postGameOptions } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { PlayerState, PostGameChoice, RoomStatus } from '@data/simulator/simulator.model';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { BoardAnimations } from './board-animations';

type Banner = { kind: 'start' } | { kind: 'end'; won: boolean; reason: string };
/** A mission the game moved on: what it asks, how far it was and is now (of its target), and whether it got done. */
interface MissionStep {
  key: string;
  text: string;
  before: number;
  after: number;
  target: number;
  done: boolean;
  gems: number;
}

const START_MS = 2800;

/** How the game was won, said from the side of whoever reads it. */
function winCondition(reason: string | null | undefined, won: boolean, loser: string): string {
  if (reason === 'surrender') return won ? `${loser} se rindió` : 'Te rendiste';
  if (reason === 'abandon') return won ? `${loser} abandonó la partida` : 'Abandonaste la partida';
  if (reason === 'deck') return won ? `${loser} no pudo robar al inicio de su turno` : 'No pudiste robar al inicio de tu turno';
  return won ? `${loser} se quedó sin vidas` : 'Te quedaste sin vidas';
}

/** The missions of `after` that moved on since `before` (none without a `before`: it is read when the game starts). */
function missionSteps(before: MissionBoard | null, after: MissionBoard | null): MissionStep[] {
  if (!before || !after) return [];
  const steps: MissionStep[] = [];
  for (const period of ['daily', 'weekly'] as const) {
    for (const m of after[period]) {
      const was: Mission | undefined = before[period].find((b) => b.id === m.id);
      const from = Math.min(was?.progress ?? 0, m.target);
      const to = Math.min(m.progress, m.target);
      if (to <= from) continue;
      steps.push({ key: `${period}|${m.id}`, text: missionText(m), before: from, after: to, target: m.target, done: to >= m.target, gems: m.gems });
    }
  }
  return steps;
}

/**
 * The game's start and end over the whole screen, always (even with the animations off). Start: both players face
 * to face, their icon and name, with "VS" between them (a moment; a click skips it). End: both players again,
 * "Victoria" or "Derrota" and how it was won, then (online) how far the game took the player's missions, with the
 * post-game choices (new game, change deck, leave).
 */
@Component({
  selector: 'eras-match-banner',
  imports: [AvatarComponent, IconComponent],
  template: `
    @if (banner(); as b) {
      <div #screen popover="manual" class="screen" [class.start]="b.kind === 'start'" [class.end]="b.kind === 'end'" [class.won]="b.kind === 'end' && b.won" role="status" aria-live="assertive" (click)="b.kind === 'start' && close()" (keydown.escape)="close()">
        @if (b.kind === 'end') {
          <strong class="title">{{ b.won ? 'Victoria' : 'Derrota' }}</strong>
        }
        <div class="players">
          @if (me(); as m) {
            <div class="player mine" [class.winner]="isWinner(m)" [class.loser]="isLoser(m)">
              @if (isWinner(m)) {
                <eras-icon class="crown" name="trophy" />
              }
              <eras-avatar [url]="m.avatar" [name]="m.username" />
              <span class="name">{{ m.username }}</span>
            </div>
          }
          <span class="vs" aria-label="contra">VS</span>
          @if (rival(); as r) {
            <div class="player rival" [class.winner]="isWinner(r)" [class.loser]="isLoser(r)">
              @if (isWinner(r)) {
                <eras-icon class="crown" name="trophy" />
              }
              <eras-avatar [url]="r.avatar" [name]="r.username" />
              <span class="name">{{ r.username }}</span>
            </div>
          }
        </div>
        @if (b.kind === 'end') {
          <span class="reason">{{ b.reason }}</span>
          @if (missionSteps().length) {
            <!-- After the result: how far this game took the player's missions -->
            <section class="missions" aria-label="Avance en las misiones">
              <h2 class="missions-title">Misiones</h2>
              <ul class="mission-list">
                @for (m of missionSteps(); track m.key) {
                  <li class="mission" [class.done]="m.done">
                    <span class="mission-text">{{ m.text }}</span>
                    <span class="mission-count">{{ m.after }} / {{ m.target }}</span>
                    <span class="mission-bar" aria-hidden="true">
                      <span class="mission-fill" [style.--from.%]="(m.before / m.target) * 100" [style.--to.%]="(m.after / m.target) * 100"></span>
                    </span>
                    @if (m.done) {
                      <span class="mission-done"><eras-icon name="check" /> ¡Completada! <eras-icon name="gem" /> {{ m.gems }} por reclamar</span>
                    }
                  </li>
                }
              </ul>
            </section>
          }
          <div class="choices">
            @if (myChoice(); as c) {
              <span class="waiting">Elegiste: {{ labels[c] }}. Esperando al rival…</span>
            } @else {
              @for (o of options(); track o) {
                <button type="button" class="choice" [class.exit]="o === 'exit'" (click)="choose(o)">{{ labels[o] }}</button>
              }
            }
          </div>
        } @else {
          <span class="hint">Comienza la partida</span>
        }
      </div>
    }
  `,
  styles: `
    /* A popover: in the browser's top layer, above the table and any choice */
    .screen {
      --mine: #38bdf8;
      --rival: #f472b6;
      position: fixed;
      inset: 0;
      inline-size: auto;
      block-size: auto;
      max-inline-size: none;
      max-block-size: none;
      margin: 0;
      padding: var(--space-6) var(--space-4);
      overflow: hidden;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: var(--space-6);
      border: 0;
      background: radial-gradient(ellipse at center, rgb(10 16 30 / 92%), rgb(0 0 0 / 96%));
      color: #f4f4f6;
    }
    .screen.start { cursor: pointer; animation: screen 2.8s ease forwards; /* START_MS */ }
    .screen.end { animation: appear 0.5s ease backwards; }
    /* A diagonal of light behind the players: cyan from your side, pink from theirs */
    .screen::before {
      content: '';
      position: absolute;
      inset: -20%;
      z-index: -1;
      background: linear-gradient(115deg, color-mix(in srgb, var(--mine) 26%, transparent) 0 48%, transparent 48% 52%, color-mix(in srgb, var(--rival) 26%, transparent) 52%);
      animation: appear 0.6s ease backwards;
    }
    /* Two equal sides with VS between them: VS stays at the middle whatever the names */
    .players {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: clamp(1rem, 5vw, 4rem);
      inline-size: min(56rem, 100%);
    }
    .player { position: relative; display: grid; justify-items: center; align-content: start; gap: var(--space-2); text-align: center; }
    .player eras-avatar { --avatar-size: clamp(5rem, 14vw, 9rem); }
    .player.mine eras-avatar { box-shadow: 0 0 0 3px var(--mine), 0 0 36px 8px color-mix(in srgb, var(--mine) 55%, transparent); }
    .player.rival eras-avatar { box-shadow: 0 0 0 3px var(--rival), 0 0 36px 8px color-mix(in srgb, var(--rival) 55%, transparent); }
    .name { max-inline-size: 100%; font: 700 clamp(1.1rem, 3vw, 1.75rem)/1.2 var(--font-family-display); overflow-wrap: anywhere; }
    .mine { animation: from-left 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.1) 0.1s backwards; }
    .rival { animation: from-right 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.1) 0.1s backwards; }
    .vs {
      font: 700 clamp(3rem, 10vw, 6rem)/1 var(--font-family-display);
      color: #fff;
      text-shadow: 0 0 10px #fde68a, 0 0 30px #f59e0b;
      animation: slam 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.4) 0.55s backwards;
    }
    .hint { color: rgb(244 244 246 / 75%); font-size: var(--font-size-sm); letter-spacing: 0.1em; text-transform: uppercase; animation: appear 0.4s ease 0.9s backwards; }
    /* The end: the banner, the winner crowned and lit, the loser dimmed */
    .title {
      animation: slam 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.2s backwards;
      font: 700 clamp(3rem, 11vw, 6.5rem)/1 var(--font-family-display);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #fecaca;
      text-shadow: 0 0 10px #ef4444, 0 0 34px #b91c1c;
    }
    .won .title { color: #fef9c3; text-shadow: 0 0 10px #fde68a, 0 0 34px #f59e0b; }
    .reason { font-size: clamp(1rem, 2.4vw, 1.25rem); color: rgb(244 244 246 / 85%); text-align: center; animation: appear 0.4s ease 0.8s backwards; }
    .end .vs { font-size: clamp(1.5rem, 5vw, 3rem); text-shadow: none; color: rgb(244 244 246 / 50%); animation: none; }
    .winner eras-avatar { animation: winner 1.6s ease-in-out 0.7s infinite alternate; }
    .loser { filter: grayscale(0.85) brightness(0.6); }
    .crown { position: absolute; inset-block-start: -2.4rem; inline-size: 2.2rem; block-size: 2.2rem; color: #fde68a; filter: drop-shadow(0 0 8px #f59e0b); animation: slam 0.5s ease 0.7s backwards; }
    .choices { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3); animation: appear 0.4s ease 1s backwards; }
    /* The missions the game moved on: after the result, each bar grows from where it was to where it is now */
    .missions { display: grid; gap: var(--space-2); inline-size: min(28rem, 100%); animation: appear 0.4s ease 1.2s backwards; }
    .missions-title { margin: 0; font: 400 var(--font-size-sm)/1.2 var(--font-family-display); letter-spacing: 0.12em; text-transform: uppercase; color: rgb(244 244 246 / 70%); text-align: center; }
    .mission-list { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
    .mission {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-1) var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 1px solid rgb(255 255 255 / 18%);
      border-radius: var(--radius-md);
      background: rgb(255 255 255 / 6%);
    }
    .mission.done { border-color: #fde68a; background: rgb(253 230 138 / 10%); }
    .mission-text { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); }
    .mission-count { font-size: var(--font-size-sm); font-variant-numeric: tabular-nums; color: rgb(244 244 246 / 80%); }
    .mission-bar { grid-column: 1 / -1; block-size: 0.4rem; overflow: hidden; border-radius: var(--radius-pill); background: rgb(255 255 255 / 15%); }
    .mission-fill { display: block; block-size: 100%; inline-size: var(--to); border-radius: inherit; background: #38bdf8; animation: mission-grow 0.9s ease 1.5s backwards; }
    .mission.done .mission-fill { background: #fde68a; }
    .mission-done { grid-column: 1 / -1; display: inline-flex; align-items: center; gap: 0.3em; color: #fde68a; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); animation: appear 0.4s ease 2.4s backwards; }
    .mission-done eras-icon { inline-size: 0.9rem; block-size: 0.9rem; }
    @keyframes mission-grow { from { inline-size: var(--from); } }
    .choice {
      padding: var(--space-2) var(--space-6);
      border: 1px solid rgb(255 255 255 / 60%);
      border-radius: var(--radius-pill);
      background: rgb(255 255 255 / 92%);
      color: #111;
      font: inherit;
      font-weight: var(--font-weight-bold);
      cursor: pointer;
    }
    .choice.exit { background: rgb(255 255 255 / 8%); color: #fff; }
    .choice:hover, .choice:focus-visible { box-shadow: 0 0 0 3px rgb(255 255 255 / 35%); }
    .waiting { color: rgb(244 244 246 / 80%); }
    @keyframes screen { 0% { opacity: 0; } 10% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes appear { from { opacity: 0; } }
    @keyframes from-left { from { opacity: 0; transform: translateX(-40vw); } }
    @keyframes from-right { from { opacity: 0; transform: translateX(40vw); } }
    @keyframes slam { from { opacity: 0; transform: scale(2.4); } }
    @keyframes winner { to { filter: brightness(1.25); scale: 1.04; } }
    @media (max-width: 40rem) {
      .players { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
    }
    @media (prefers-reduced-motion: reduce) {
      .screen, .screen::before, .mine, .rival, .vs, .hint, .title, .reason, .crown, .choices, .winner eras-avatar { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchBannerComponent {
  /** "Salir" chosen at the end: the board leaves the room. */
  readonly leave = output<void>();
  private readonly game = inject(GameStore);
  private readonly auth = inject(AuthService);
  private readonly animations = inject(BoardAnimations);
  private readonly missions = inject(MissionsStore);
  /** The missions as they were when the game started (online only: solo mode counts for none). */
  private readonly missionsBefore = signal<MissionBoard | null>(null);
  /** At the end: the missions this game moved on. */
  protected readonly missionSteps = computed(() => (this.end() ? missionSteps(this.missionsBefore(), this.missions.board()) : []));
  private readonly screen = viewChild<ElementRef<HTMLElement>>('screen');
  protected readonly labels = POST_GAME_LABELS;
  /** The start, for a moment. */
  private readonly start = signal(false);
  /** The end, while the room is in its post-game: who won (from this account's side) and how. */
  private readonly end = computed<Banner | null>(() => {
    const state = this.game.state();
    if (state?.status !== 'POST_GAME' || !state.winnerId) return null;
    const won = state.winnerId === this.auth.user()?.id;
    const loser = Object.values(state.players ?? {}).find((p) => p.userId !== state.winnerId)?.username ?? 'Tu rival';
    return { kind: 'end', won, reason: winCondition(state.endReason, won, loser) };
  });
  protected readonly banner = computed<Banner | null>(() => this.end() ?? (this.start() ? { kind: 'start' } : null));
  protected readonly myChoice = computed(() => this.game.postGameChoices()[this.auth.user()?.id ?? ''] ?? null);
  /** What can be chosen now (after a surrender, the one who surrendered waits for the other's choice). */
  protected readonly options = computed(() => {
    const state = this.game.state();
    const surrenderer = state?.event === 'SURRENDER' ? state.actorId : null;
    const me = this.auth.user()?.id;
    const iSurrendered = !!surrenderer && surrenderer === me;
    const theirChoice = surrenderer && surrenderer !== me ? (this.game.postGameChoices()[surrenderer] ?? null) : null;
    // Alone (the rival left): no rematch
    return postGameOptions(iSurrendered, theirChoice).filter((o) => o !== 'new_game' || !!this.game.opponentState());
  });
  protected readonly me = computed(() => this.game.myState());
  protected readonly rival = computed(() => this.game.opponentState());
  /** The status seen last time (null until the first: joining a game under way shows nothing). */
  private lastStatus: RoomStatus | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private release: (() => void) | null = null;

  constructor() {
    effect(() => {
      const status = this.game.status();
      untracked(() => this.onStatus(status));
    });
    // Raised to the top layer once drawn
    afterRenderEffect(() => {
      const el = this.screen()?.nativeElement;
      if (el && !el.matches(':popover-open')) el.showPopover?.();
    });
  }

  protected choose(choice: PostGameChoice): void {
    // Leaving frees the seat (the board sends it on its way out)
    if (choice === 'exit') this.leave.emit();
    else this.game.postGameChoice(choice);
  }

  protected isWinner(p: PlayerState): boolean {
    const b = this.banner();
    return b?.kind === 'end' && this.game.state()?.winnerId === p.userId;
  }

  protected isLoser(p: PlayerState): boolean {
    const b = this.banner();
    return b?.kind === 'end' && !!this.game.state()?.winnerId && this.game.state()?.winnerId !== p.userId;
  }

  /** The start ends (its time is up, or a click). */
  protected close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.start.set(false);
    this.release?.();
    this.release = null;
  }

  private onStatus(status: RoomStatus | null): void {
    const before = this.lastStatus;
    this.lastStatus = status;
    if (before === null || before === status) return;
    // Online, the missions are read when the game starts and again when it ends: the end shows how far it took them
    if (!this.game.editorRoom()) {
      if (status === 'IN_PROGRESS' && before !== 'IN_PROGRESS') void this.missions.load().then(() => this.missionsBefore.set(this.missions.board()));
      if (status === 'POST_GAME') void this.missions.load();
    }
    // The game starts (after the mulligan, or right away): shown even with the animations off
    if (status === 'IN_PROGRESS' && (before === 'MULLIGAN' || before === 'SELECTING_STARTER' || before === 'WAITING' || before === 'POST_GAME')) {
      this.close();
      this.start.set(true);
      // The first choices wait for it
      this.release = this.animations.begin();
      this.timer = setTimeout(() => this.close(), START_MS);
      return;
    }
    if (status !== 'IN_PROGRESS') this.close();
  }
}
