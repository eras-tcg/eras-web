import { CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { CardsStore } from '@data/cards/cards.store';
import { sharedIndexForValue, sharedValueForIndex } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { ChainListComponent } from './chain-list.component';
import { STATUS_LABELS } from '@data/simulator/simulator.model';
import { SharedBarComponent } from '@ui/domain/game-counters/shared-bar.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { BoardDialogs } from './board-dialogs';
import { BoardEffects } from './board-effects';
import { BoardDrag } from './board-drag';
import { PlayerHalfComponent } from './player-half.component';
import { StatusPanelsComponent } from './status-panels.component';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { DOCUMENT } from '@angular/common';
import { CardFlightsComponent } from './card-flights.component';
import { BoardAnimations } from './board-animations';
import { DamageRevealComponent } from './damage-reveal.component';

const PHASE_LABELS: Record<string, string> = { START: 'Inicio de turno', MAIN: 'Fase principal', END: 'Fase final', END_PHASE: 'Fase final' };

/** Game table: opponent on top (mirrored), you below, turn controls, shared gem bar and live notices. */
@Component({
  selector: 'eras-board-page',
  imports: [CardFlightsComponent, DamageRevealComponent, ChainListComponent, PlayerHalfComponent, StatusPanelsComponent, SharedBarComponent, StackComponent, AlertComponent, EmptyStateComponent, ButtonComponent, SpinnerComponent, CdkMenuTrigger, MenuComponent, MenuItemDirective],
  providers: [BoardDrag, BoardDialogs, BoardEffects, BoardAnimations],
  templateUrl: './board.page.html',
  styleUrl: './board.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A click elsewhere or Esc hides the selected card's actions (cards stop their own clicks)
  host: { '(document:keydown.escape)': 'game.pendingTargetSource.set(null); game.selectedId.set(null)', '(click)': 'game.selectedId.set(null)' },
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

  protected readonly statusLabel = computed(() => (this.game.status() ? STATUS_LABELS[this.game.status()!] : 'Conectando…'));
  protected readonly phaseLabel = computed(() => PHASE_LABELS[this.game.phase()] ?? this.game.phase());
  protected readonly inProgress = computed(() => this.game.status() === 'IN_PROGRESS');
  protected readonly sharedIndex = computed(() => sharedIndexForValue(this.game.state()?.sharedCounter ?? 0, this.game.isFirstPlayer()));
  protected readonly opponentLeft = computed(() => this.game.opponentState()?.connected === false);
  protected readonly dismissedLeft = signal(false);
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

    // "Cambiar mazo" after a game sends the room back to WAITING: pick a deck again in the lobby
    let previous: string | null = null;
    effect(() => {
      const status = this.game.status();
      if (previous === 'POST_GAME' && status === 'WAITING') {
        this.leaving = true;
        void this.router.navigate(['/simulator', this.roomId()], { replaceUrl: true });
      }
      previous = status;
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

  protected async closeRoom(): Promise<void> {
    this.game.closeRoom();
    this.leaving = true;
    await this.router.navigateByUrl('/home');
  }

  /** Route guard: leaving a game in progress asks first; leaving always disconnects. */
  async confirmLeave(): Promise<boolean> {
    if (!this.leaving && this.game.status() === 'IN_PROGRESS') {
      const ok = await this.modal.confirm({ title: 'Salir de la partida', message: 'La partida sigue sin ti; puedes volver desde el enlace de la sala.', confirmLabel: 'Salir' });
      if (!ok) return false;
    }
    // Going back to the lobby of the same room keeps the connection (it reconnects there)
    this.game.disconnect();
    return true;
  }
}
