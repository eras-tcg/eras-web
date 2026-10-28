import { CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { CardsStore } from '@data/cards/cards.store';
import { sharedIndexForValue, sharedValueForIndex } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
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

const PHASE_LABELS: Record<string, string> = { MAIN: 'Fase principal', END: 'Fase final' };

/** Game table: opponent on top (mirrored), you below, turn controls, shared gem bar and live notices. */
@Component({
  selector: 'eras-board-page',
  imports: [PlayerHalfComponent, StatusPanelsComponent, SharedBarComponent, StackComponent, AlertComponent, EmptyStateComponent, ButtonComponent, SpinnerComponent, CdkMenuTrigger, MenuComponent, MenuItemDirective],
  providers: [BoardDrag, BoardDialogs, BoardEffects],
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

  constructor() {
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
      untracked(() => {
        if (open && open.id !== prompt?.id) {
          open.close();
          open = null;
        }
        if (prompt && !open) {
          const ref = this.dialogs.effectPrompt({ prompt });
          open = { id: prompt.id, close: () => ref.close() };
        }
      });
    });
    inject(DestroyRef).onDestroy(() => open?.close());
  }

  /** What the engine is doing: the effect resolving, or the optional effect waiting to be activated. */
  protected readonly engineNotice = computed(() => {
    const effect = this.game.resolving();
    if (effect) return `${effect.sourceName} · ${effect.label}`;
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
