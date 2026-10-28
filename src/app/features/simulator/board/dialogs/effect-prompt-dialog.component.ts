import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { DIALOG_DATA } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { fieldRows } from '@data/simulator/legal-actions';
import { ChainListComponent } from '../chain-list.component';
import { CardSlot, EffectPrompt } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SheetComponent } from '@ui/surfaces/sheet/sheet.component';

export interface EffectPromptData {
  prompt: EffectPrompt;
}

/**
 * A choice the rules engine is waiting for. It cannot be dismissed: the effect goes on only after the player
 * confirms a valid selection. Cards that do not meet the effect are shown locked. When the cards not chosen
 * go back to the deck (reorderRest), their order is set by dragging.
 */
@Component({
  selector: 'eras-effect-prompt-dialog',
  imports: [SheetComponent, GameCardComponent, StackComponent, ButtonComponent, IconComponent, CdkDropList, CdkDrag, ChainListComponent],
  template: `
    <eras-sheet size="lg" [closable]="false" [title]="prompt.title" [subtitle]="prompt.instruction">
      <eras-chain-list />
      @if (prompt.reorderRest) {
        <p class="hint">Haz clic en una carta válida para llevarla a tu mano. Arrastra las demás para ordenarlas: irán al fondo de tu mazo en ese orden (la de la izquierda queda más arriba).</p>
      }
      <div
        class="cards"
        cdkDropList
        cdkDropListOrientation="horizontal"
        [cdkDropListDisabled]="!prompt.reorderRest"
        (cdkDropListDropped)="reorder($event)"
        role="group"
        [attr.aria-label]="prompt.title"
      >
        @for (c of order(); track c.instanceId) {
          <div class="slot" cdkDrag [cdkDragDisabled]="!prompt.reorderRest || chosen().has(c.instanceId)">
            <button
              type="button"
              class="pick"
              [class.static]="prompt.kind === 'CONFIRM'"
              [class.chosen]="chosen().has(c.instanceId)"
              [class.locked]="!valid.has(c.instanceId)"
              [disabled]="!valid.has(c.instanceId) || sending() || prompt.kind === 'CONFIRM'"
              [attr.aria-pressed]="chosen().has(c.instanceId)"
              [attr.aria-label]="(c.cardName ?? 'Carta') + (valid.has(c.instanceId) ? '' : ', no cumple el efecto')"
              (click)="toggle(c.instanceId)"
            >
              <eras-game-card [imageUrl]="c.imageUrl" />
              <span class="tag">
                @if (chosen().has(c.instanceId)) {
                  <eras-icon name="check" /> {{ chosenTag(c.instanceId) }}
                } @else if (prompt.kind === 'CONFIRM') {
                  {{ c.cardName }}
                } @else if (!valid.has(c.instanceId)) {
                  No cumple
                } @else if (prompt.cardLabels?.[c.instanceId]; as effectLabel) {
                  {{ effectLabel }}
                } @else {
                  {{ c.cardName }}
                }
              </span>
              @if (zoneOf(c); as zone) {
                <span class="zone">{{ zone }}</span>
              }
            </button>
          </div>
        }
      </div>
      <ng-container sheet-footer>
        <eras-stack direction="row" [gap]="2" align="center" justify="end" wrap>
          @if (prompt.kind === 'CONFIRM') {
            <button erasButton variant="secondary" type="button" [disabled]="sending()" (click)="answer(false)">No</button>
            <button erasButton type="button" [disabled]="sending()" [loading]="sending()" (click)="answer(true)">Sí</button>
          } @else {
            <span class="count">{{ chosen().size }} de {{ prompt.max }}</span>
            <button erasButton type="button" [disabled]="!canConfirm()" [loading]="sending()" (click)="confirm()">{{ confirmLabel() }}</button>
          }
        </eras-stack>
      </ng-container>
    </eras-sheet>
  `,
  styles: `
    .hint { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .cards {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      min-block-size: 12rem;
    }
    .slot { display: flex; }
    .slot.cdk-drag-preview { box-shadow: var(--shadow-lg); }
    .slot.cdk-drag-placeholder { opacity: 0.3; }
    .cdk-drop-list-dragging .slot:not(.cdk-drag-placeholder) { transition: transform var(--duration-base) var(--easing-standard); }
    .pick {
      --game-card-width: 7rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1);
      border: 2px solid transparent;
      border-radius: var(--radius-md);
      background: none;
      color: inherit;
      cursor: pointer;
    }
    .pick:hover:not(:disabled) { background: var(--color-surface-muted); }
    .pick.chosen { border-color: var(--color-success); background: color-mix(in srgb, var(--color-success) 12%, transparent); }
    .pick.locked { opacity: 0.4; cursor: not-allowed; }
    .pick.static, .pick.static:disabled { opacity: 1; cursor: default; }
    .pick:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      max-inline-size: 8rem;
      font-size: var(--font-size-xs);
      text-align: center;
    }
    .pick.chosen .tag { color: var(--color-success); font-weight: var(--font-weight-bold); }
    .count { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .zone { color: var(--color-text-muted); font-size: 0.65rem; letter-spacing: 0.04em; text-transform: uppercase; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectPromptDialogComponent {
  private readonly game = inject(GameStore);
  protected readonly prompt = inject<EffectPromptData>(DIALOG_DATA).prompt;

  protected readonly valid = new Set(this.prompt.validIds);
  protected readonly order = signal<CardSlot[]>([...this.prompt.cards]);
  protected readonly chosen = signal<Set<string>>(new Set());
  protected readonly sending = signal(false);
  protected readonly canConfirm = computed(() => {
    const n = this.chosen().size;
    return !this.sending() && n >= this.prompt.min && n <= this.prompt.max;
  });

  /** Optional choices can be confirmed with nothing chosen ("No bloquear"). */
  protected readonly confirmLabel = computed(() => {
    if (this.chosen().size > 0 && this.prompt.purpose === 'RITUAL') return 'Invocar';
    if (this.chosen().size > 0 && this.prompt.purpose === 'PRIORITY') return 'Activar';
    if (this.prompt.purpose === 'ORDER') return 'Encadenar';
    if (this.prompt.purpose === 'OPTIONAL') return this.chosen().size > 0 ? 'Encadenar' : 'No encadenar más';
    if (this.chosen().size > 0 || this.prompt.min > 0) return 'Confirmar';
    if (this.prompt.purpose === 'RITUAL') return 'No invocar';
    if (this.prompt.purpose === 'PRIORITY') return 'Pasar';
    if (this.prompt.purpose === 'BLOCK') return 'No bloquear';
    if (this.prompt.purpose === 'PROVOKE') return 'No provocar';
    if (this.prompt.purpose === 'ADVANCE') return 'No subir ninguna';
    return this.prompt.chosenLabel === 'Atacar' ? 'Atacar al rival' : 'Continuar sin elegir';
  });

  constructor() {
    // The server rejected the answer: let the player fix it and confirm again
    effect(() => {
      if (this.game.error()) this.sending.set(false);
    });
    // The board marks the cards chosen here (seen when the sheet is lowered)
    effect(() => this.game.promptChosen.set(new Set(this.chosen())));
    inject(DestroyRef).onDestroy(() => this.game.promptChosen.set(new Set()));
  }

  /** Where a card of the field is, with its place in that line from the left: tells copies apart. */
  protected zoneOf(c: CardSlot): string | null {
    const field = Object.values(this.game.state()?.players ?? {}).find((p) => p.field.some((f) => f.instanceId === c.instanceId))?.field;
    if (!field) return null;
    const rows = fieldRows(field);
    const front = rows.front.findIndex((f) => f.instanceId === c.instanceId);
    if (front >= 0) return `Línea frontal · ${front + 1}`;
    return `Retaguardia · ${rows.back.findIndex((f) => f.instanceId === c.instanceId) + 1}`;
  }

  protected toggle(id: string): void {
    if (!this.valid.has(id)) return;
    const next = new Set(this.chosen());
    if (next.has(id)) next.delete(id);
    else if (next.size < this.prompt.max) next.add(id);
    else if (this.prompt.max === 1) {
      next.clear();
      next.add(id);
    }
    this.chosen.set(next);
  }

  protected reorder(event: CdkDragDrop<CardSlot[]>): void {
    const list = [...this.order()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.order.set(list);
  }

  /** What a chosen card shows: its chain link when ordering triggers, else what happens to it. */
  protected chosenTag(id: string): string {
    if (this.prompt.purpose === 'ORDER' || this.prompt.purpose === 'OPTIONAL') {
      // The real link it will take: after the links already in the chain
      const base = this.game.state()?.chain?.length ?? 0;
      const label = this.prompt.cardLabels?.[id];
      return `Cadena ${base + [...this.chosen()].indexOf(id) + 1}${label ? ' · ' + label : ''}`;
    }
    return this.prompt.chosenLabel ?? 'Elegida';
  }

  /** CONFIRM prompts: choosing the card means yes. */
  protected answer(yes: boolean): void {
    this.sending.set(true);
    this.game.resolvePrompt(this.prompt.id, yes ? this.prompt.validIds.slice(0, 1) : []);
  }

  /** The board closes this dialog when the engine moves on to the next step. */
  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.sending.set(true);
    const chosen = [...this.chosen()];
    const rest = this.order().filter((c) => !this.chosen().has(c.instanceId)).map((c) => c.instanceId);
    this.game.resolvePrompt(this.prompt.id, chosen, rest);
  }
}
