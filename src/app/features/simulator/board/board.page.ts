import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { EditModeService } from '@core/auth/edit-mode.service';
import { CardsStore } from '@data/cards/cards.store';
import { sharedIndexForValue, sharedValueForIndex } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { ChainListComponent } from './chain-list.component';
import { SharedBarComponent } from '@ui/domain/game-counters/shared-bar.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { BoardDialogs } from './board-dialogs';
import { BoardEffects } from './board-effects';
import { BoardDrag } from './board-drag';
import { PlayerHalfComponent } from './player-half.component';
import { StatusPanelsComponent } from './status-panels.component';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { CardFlightsComponent } from './card-flights.component';
import { BoardAnimations } from './board-animations';
import { DamageRevealComponent } from './damage-reveal.component';
import { PromptSpotlightComponent } from './prompt-spotlight.component';
import { PreRoomComponent } from './pre-room.component';

const MIRRORED_KEY = 'eras-sim-mirrored';
const SIDEBAR_KEY = 'eras-sim-sidebar-expanded';
const DYNAMIC_KEY = 'eras-sim-sidebar-dynamic';
const HEADER_KEY = 'eras-sim-header-hidden';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // Not remembered (private window, blocked storage)
  }
}

const PHASE_LABELS: Record<string, string> = { START: 'Inicio de turno', MAIN: 'Fase principal', END: 'Fase final', END_PHASE: 'Fase final' };

/** Game table: opponent on top (mirrored), you below, turn controls, shared gem bar and live notices. */
@Component({
  selector: 'eras-board-page',
  imports: [NgTemplateOutlet, CardFlightsComponent, DamageRevealComponent, PromptSpotlightComponent, PreRoomComponent, ChainListComponent, PlayerHalfComponent, StatusPanelsComponent, SharedBarComponent, StackComponent, AlertComponent, EmptyStateComponent, ButtonComponent, SpinnerComponent, IconComponent],
  providers: [BoardDrag, BoardDialogs, BoardEffects, BoardAnimations],
  templateUrl: './board.page.html',
  styleUrl: './board.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A click elsewhere or Esc hides the selected card's actions (cards stop their own clicks)
  host: {
    '(document:keydown.escape)': 'game.pendingTargetSource.set(null); game.selectedId.set(null)',
    '(click)': 'game.selectedId.set(null)',
    '(document:fullscreenchange)': 'fullscreen.set(!!document.fullscreenElement)',
    '[class.fullscreen]': 'fullscreen()',
    '[class.in-game]': 'inGame()',
  },
})
export class BoardPage {
  /** Route param `:roomId`. */
  readonly roomId = input.required<string>();

  protected readonly game = inject(GameStore);
  private readonly animations = inject(BoardAnimations);
  /** A choice is lowered to look at the table: nothing can be done meanwhile. */
  protected readonly lookOnly = inject(SheetState).lowered;
  private readonly document = inject(DOCUMENT);
  protected readonly dialogs = inject(BoardDialogs);
  private readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  /** The site's edit mode banner already says it: no badge of its own then. */
  protected readonly editMode = inject(EditModeService);

  protected readonly phaseLabel = computed(() => PHASE_LABELS[this.game.phase()] ?? this.game.phase());
  protected readonly inProgress = computed(() => this.game.status() === 'IN_PROGRESS');
  /** Test room: whose turn it is, by name (both sides are mine). */
  /** Inside a game (after the pre-room): the options sidebar and the hidden navigation bar apply. */
  protected readonly inGame = computed(() => !!this.game.status() && this.game.status() !== 'WAITING');
  protected readonly sharedIndex = computed(() => sharedIndexForValue(this.game.state()?.sharedCounter ?? 0, this.game.isFirstPlayer()));
  protected readonly opponentLeft = computed(() => this.game.opponentState()?.connected === false);
  /** The owner of the room is the rival (if they stay away, the room passes to me). */
  protected readonly rivalOwns = computed(() => !!this.game.state()?.hostId && this.game.state()?.hostId === this.game.opponentState()?.userId);
  protected readonly dismissedLeft = signal(false);
  /** "Zonas espejadas": the rival's lives and gems swap with their piles. Remembered on the device. */
  protected readonly mirrored = signal(readFlag(MIRRORED_KEY));
  /** The site's navigation bar is hidden to give the table more height. Remembered on the device. */
  protected readonly headerHidden = signal(readFlag(HEADER_KEY));
  /** The options sidebar: expanded (names beside the icons), or dynamic (it expands while the pointer is on it). */
  protected readonly sidebarExpanded = signal(readFlag(SIDEBAR_KEY));
  protected readonly sidebarDynamic = signal(readFlag(DYNAMIC_KEY));
  protected readonly sidebarHover = signal(false);
  protected readonly sidebarOpen = computed(() => (this.sidebarDynamic() ? this.sidebarHover() : this.sidebarExpanded()));
  /** Browser full screen: the field cards get the extra room. */
  protected readonly fullscreen = signal(false);
  /** Test room: the other side, to look at the table from it. */
  protected readonly otherSide = computed(() => this.game.sides().find((p) => p.userId !== this.game.myState()?.userId) ?? null);
  private leaving = false;

  /** The phases of the turn in the bar. */
  protected readonly phases = [
    { id: 'START', label: 'Inicio' },
    { id: 'MAIN', label: 'Principal' },
    { id: 'END_PHASE', label: 'Final' },
  ];
  protected readonly currentPhase = computed(() => (this.game.phase() === 'END' ? 'END_PHASE' : this.game.phase()));

  /**
   * On your turn, with nothing pending, the main phase goes on to the end phase. The end phase is closed: once its
   * move up and its triggers are done the turn ends by itself (a stuck end phase can still be closed by hand).
   */
  protected canGoTo(phase: string): boolean {
    if (!this.game.isMyTurn() || this.lookOnly() || this.game.state()?.prompt || this.game.state()?.chain?.length || this.game.state()?.combat) return false;
    return phase === 'END_PHASE' && (this.currentPhase() === 'MAIN' || this.currentPhase() === 'END_PHASE');
  }

  protected phaseHint(phase: string): string {
    if (!this.canGoTo(phase)) return '';
    return this.currentPhase() === 'END_PHASE' ? 'Terminar el turno' : 'Pasar a la fase final: al terminarla, termina tu turno';
  }

  protected goTo(phase: string): void {
    if (!this.canGoTo(phase)) return;
    if (this.currentPhase() === 'END_PHASE') this.game.endTurn();
    else this.game.enterEndPhase();
  }
  /** A short pop-up when the turn or the phase changes. */
  protected readonly phasePopup = signal<{ who: string; phase: string; mine: boolean } | null>(null);
  private lastPhase: string | null = null;
  private lastTurn: string | null = null;
  private popupTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly popups: { who: string; phase: string; mine: boolean }[] = [];

  constructor() {
    effect(() => {
      const s = this.game.state();
      if (s?.status !== 'IN_PROGRESS' || !s.currentTurnUserId) {
        this.lastPhase = null;
        return;
      }
      const key = s.currentTurnUserId + '|' + s.currentPhase;
      const first = this.lastPhase === null;
      if (key === this.lastPhase) return;
      const newTurn = this.lastTurn !== null && this.lastTurn !== s.currentTurnUserId;
      this.lastPhase = key;
      this.lastTurn = s.currentTurnUserId;
      if (first) return;
      const mine = s.currentTurnUserId === this.game.myState()?.userId;
      const name = s.players?.[s.currentTurnUserId]?.username ?? 'Rival';
      const who = mine ? 'Tu turno' : 'Turno de ' + name;
      untracked(() => {
        // A new turn always shows its start, even when it went straight on to the main phase
        if (newTurn && s.currentPhase !== 'START') this.popups.push({ who, phase: PHASE_LABELS['START'], mine });
        this.popups.push({ who, phase: PHASE_LABELS[s.currentPhase ?? 'MAIN'] ?? s.currentPhase ?? '', mine });
        if (!this.popupTimer) this.nextPopup();
      });
    });
    // The page glows from the side of whoever has the priority
    effect(() => {
      const acting = this.game.actingId();
      const me = this.game.myState()?.userId;
      this.document.body.classList.toggle('eras-acting-me', !!acting && acting === me);
      this.document.body.classList.toggle('eras-acting-rival', !!acting && acting !== me);
    });
    // The site's navigation bar, hidden while on the table if asked
    effect(() => this.document.body.classList.toggle('eras-hide-header', this.headerHidden() && this.inGame()));
    inject(DestroyRef).onDestroy(() => this.document.body.classList.remove('eras-hide-header'));
    // A chain is shown above the choices (they leave it room)
    effect(() => this.document.body.classList.toggle('eras-chain-open', !!this.game.state()?.chain?.length));
    inject(DestroyRef).onDestroy(() => this.document.body.classList.remove('eras-acting-me', 'eras-acting-rival', 'eras-chain-open'));
    // Card details in dialogs come from the catalog
    void this.cards.load();

    // Opening the board URL directly (reload, shared link) goes through the lobby, which joins the room
    effect(() => {
      const room = this.roomId();
      untracked(() => {
        if (this.game.roomId() !== room || !this.game.connected()) void this.router.navigate(['/simulator', room], { replaceUrl: true });
      });
    });

    // Taken out of the room (or it closed): back to the lobby, which says why
    effect(() => {
      if (!this.game.removed()) return;
      untracked(() => {
        this.leaving = true;
        void this.router.navigateByUrl('/simulator', { replaceUrl: true });
      });
    });

    effect(() => {
      if (!this.opponentLeft()) this.dismissedLeft.set(false);
    });

    // Rules-engine choices: one blocking dialog per prompt; it closes when the engine moves on
    let open: { id: string; close: () => void } | null = null;
    effect(() => {
      const prompt = this.game.myPrompt();
      // The choice waits until the animations on the table are over (a card flying, direct damage)
      const idle = this.animations.idle();
      untracked(() => {
        if (open && open.id !== prompt?.id) {
          open.close();
          open = null;
        }
        if (prompt && !open && idle) {
          // A short wait lets the animations of this very update start first
          setTimeout(() => {
            if (open || !this.animations.idle() || this.game.myPrompt()?.id !== prompt.id) return;
            const ref = this.dialogs.effectPrompt({ prompt });
            open = { id: prompt.id, close: () => ref.close() };
          }, 80);
        }
      });
    });
    inject(DestroyRef).onDestroy(() => open?.close());
  }

  protected toggleMirrored(): void {
    this.mirrored.update((on) => !on);
    writeFlag(MIRRORED_KEY, this.mirrored());
  }

  protected toggleSidebar(): void {
    this.sidebarExpanded.update((on) => !on);
    writeFlag(SIDEBAR_KEY, this.sidebarExpanded());
    // Collapsing it by hand leaves it collapsed until hovered again
    if (!this.sidebarExpanded()) this.sidebarHover.set(false);
  }

  protected toggleDynamic(): void {
    this.sidebarDynamic.update((on) => !on);
    writeFlag(DYNAMIC_KEY, this.sidebarDynamic());
  }

  protected async toggleFullscreen(): Promise<void> {
    try {
      if (this.document.fullscreenElement) await this.document.exitFullscreen();
      else await this.document.documentElement.requestFullscreen();
    } catch {
      // The browser refused it (no user gesture, not allowed): nothing changes
    }
  }

  protected toggleHeader(): void {
    this.headerHidden.update((on) => !on);
    writeFlag(HEADER_KEY, this.headerHidden());
  }

  private nextPopup(): void {
    const popup = this.popups.shift() ?? null;
    this.phasePopup.set(popup);
    this.popupTimer = popup ? setTimeout(() => this.nextPopup(), 1300) : null;
  }

  /** What the engine is doing: the effect resolving, or the optional effect waiting to be activated. */
  protected readonly engineNotice = computed(() => {
    const effect = this.game.resolving();
    // The chain itself is listed by <eras-chain-list>; while it is being built nothing resolves yet
    if (effect?.resolutionId) return `Resolviendo Cadena ${effect.link}: ${effect.sourceName} · ${effect.label}`;
    const prompt = this.game.state()?.prompt;
    if (prompt) return prompt.title;
    const combat = this.game.state()?.combat;
    if (!combat) return null;
    const all = Object.values(this.game.state()?.players ?? {}).flatMap((p) => p.field);
    const name = (id: string | null) => all.find((c) => c.instanceId === id)?.cardName ?? 'una criatura';
    const steps = { ATTACK: 'ataque', BLOCK: 'bloqueo', CLASH: 'enfrentamiento', DAMAGE: 'daño directo', END: 'final' } as const;
    return `Combate (${steps[combat.step]}): ${name(combat.attackerId)} ataca a ${combat.targetId ? name(combat.targetId) : 'su rival'}`;
  });

  /** Waiting on the opponent's choice for an effect. */
  protected readonly opponentChoosing = computed(() => {
    const prompt = this.game.state()?.prompt;
    return !!prompt && !this.game.myPrompt();
  });

  protected selectShared(index: number): void {
    // Moving the gems by hand is an editor action
    if (this.lookOnly() || !this.game.editorMode()) return;
    this.game.setCounter(sharedValueForIndex(index, this.game.isFirstPlayer()));
  }

  protected async surrender(): Promise<void> {
    if (await this.modal.confirm({ title: 'Rendirse', message: '¿Seguro que quieres rendirte?', confirmLabel: 'Rendirse', danger: true })) this.game.surrender();
  }

  protected async exit(): Promise<void> {
    await this.router.navigateByUrl('/simulator');
  }

  /** The owner takes the disconnected rival out of the room (the game ends; the pre-room waits for another). */
  protected kickRival(): void {
    const rival = this.game.opponentState();
    if (rival) this.game.kickPlayer(rival.userId);
  }

  /**
   * Route guard. Leaving a game in course asks first and keeps the seat (the owner may wait for you or take you
   * out); leaving the pre-room or a finished game frees the seat. Leaving always disconnects.
   */
  async confirmLeave(): Promise<boolean> {
    const status = this.game.status();
    const playing = status === 'IN_PROGRESS' || status === 'MULLIGAN' || status === 'SELECTING_STARTER';
    if (!this.leaving && playing) {
      const ok = await this.modal.confirm({
        title: 'Salir de la partida',
        message: this.game.isHost()
          ? 'La partida sigue sin ti y puedes volver desde el enlace de la sala. Si no vuelves pronto, tu rival pasa a ser el dueño de la sala.'
          : 'La partida sigue sin ti y puedes volver desde el enlace de la sala, pero el dueño de la sala puede sacarte mientras no estés.',
        confirmLabel: 'Salir',
      });
      if (!ok) return false;
    }
    if (!playing && !this.game.removed() && this.game.myState()) this.game.leaveRoom();
    // Going back to the lobby of the same room keeps the connection (it reconnects there)
    this.game.disconnect();
    return true;
  }
}
