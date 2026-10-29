import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EffectAction, actionLabel, effectActions } from '@data/simulator/effect-actions';
import { ZoneName } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { BoardEffects } from '../board-effects';

export interface EffectsDialogData {
  instanceId: string;
  zone: ZoneName;
}

/**
 * Assisted effects of one of your cards: each effect's text with buttons for the basic actions it mentions.
 * Nothing happens on its own: the player decides when each step applies (conditions, "Luego:", costs).
 */
@Component({
  selector: 'eras-effects-dialog',
  imports: [ModalComponent, CardComponent, StackComponent, GameCardComponent, EmptyStateComponent, BadgeComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal size="lg" [title]="'Efectos de ' + (card()?.slot?.cardName ?? 'la carta')" subtitle="Usa cada acción cuando corresponda; tú decides las condiciones y los objetivos." (closed)="ref.close()">
      @if (card(); as c) {
        <div class="layout">
          <eras-game-card class="art" [imageUrl]="c.slot.imageUrl" [name]="c.slot.cardName ?? null" />
          <eras-stack [gap]="3">
            @for (e of effects(); track $index; let i = $index) {
              <eras-card padding="sm">
                <eras-stack [gap]="2">
                  <eras-stack direction="row" [gap]="1" wrap>
                    @if (e.effect.instance) {
                      <eras-badge>{{ e.effect.instance }}</eras-badge>
                    }
                    @if (e.effect.inherited) {
                      <eras-badge tone="success">Heredado</eras-badge>
                    }
                    @if (e.effect.usageLimit) {
                      <eras-badge tone="danger">{{ e.effect.usageLimit }}</eras-badge>
                    }
                  </eras-stack>
                  <p class="text">{{ e.effect.text }}</p>
                  @if (e.actions.length) {
                    <eras-stack direction="row" [gap]="2" wrap>
                      @for (a of e.actions; track $index; let j = $index) {
                        <button
                          erasButton
                          size="sm"
                          type="button"
                          [variant]="used().has(i + ':' + j) ? 'secondary' : 'primary'"
                          [loading]="busy() === i + ':' + j"
                          [disabled]="!!busy()"
                          (click)="run(a, i + ':' + j)"
                        >
                          @if (used().has(i + ':' + j)) {
                            <eras-icon name="check" />
                          }
                          {{ label(a) }}
                        </button>
                      }
                    </eras-stack>
                  } @else {
                    <span class="manual">Sin acciones automáticas: resuélvelo a mano en el tablero.</span>
                  }
                </eras-stack>
              </eras-card>
            } @empty {
              <eras-empty-state title="Esta carta no tiene efectos" />
            }
          </eras-stack>
        </div>
      } @else {
        <eras-empty-state title="La carta ya no está en tu lado del tablero" />
      }
    </eras-modal>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: 9rem minmax(0, 1fr);
      align-items: start;
      gap: var(--space-4);
    }
    .art { --game-card-width: 9rem; }
    .text { margin: 0; line-height: var(--line-height-base); }
    .manual { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    @media (max-width: 36rem) {
      .layout { grid-template-columns: 1fr; }
      .art { justify-self: center; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectsDialogComponent {
  protected readonly data = inject<EffectsDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly board = inject(BoardEffects);

  /** Follows the card as the game state changes (it may move zones while you use its effects). */
  protected readonly card = computed(() => this.board.find(this.data.instanceId));
  protected readonly effects = computed(() => {
    const c = this.card();
    if (!c) return [];
    return this.board.effects(c.slot, c.zone).map((effect) => ({
      effect,
      actions: effectActions(effect.text).filter((a) => this.board.runnable(a)),
    }));
  });
  protected readonly used = signal<Set<string>>(new Set());
  protected readonly busy = signal<string | null>(null);

  protected label(a: EffectAction): string {
    return actionLabel(a);
  }

  protected async run(action: EffectAction, key: string): Promise<void> {
    const c = this.card();
    if (!c) return;
    this.busy.set(key);
    try {
      if (await this.board.run(action, { instanceId: c.slot.instanceId, zone: c.zone })) {
        this.used.update((s) => new Set(s).add(key));
      }
    } finally {
      this.busy.set(null);
    }
  }
}
