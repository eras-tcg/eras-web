import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { DIALOG_DATA } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { fieldRows } from '@data/simulator/legal-actions';
import { CardSlot, EffectPrompt, OfferedEffect } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { CardWithSourceComponent } from '@ui/domain/card-with-source/card-with-source.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SheetComponent } from '@ui/surfaces/sheet/sheet.component';

export interface EffectPromptData {
  prompt: EffectPrompt;
}

/**
 * A choice the rules engine is waiting for. It cannot be dismissed: the effect goes on only after the player
 * confirms a valid selection. Only the cards that meet the effect are shown (a toggle shows the rest, locked).
 * When the cards not chosen go back to the deck (reorderRest), their order is set by dragging. Chaining choices
 * list each effect with its card: a card can trigger several at once (its own and the inherited ones). The chain
 * itself is shown on the board, above this sheet.
 */
@Component({
  selector: 'eras-effect-prompt-dialog',
  imports: [SheetComponent, GameCardComponent, StackComponent, ButtonComponent, IconComponent, CdkDropList, CdkDrag, CardWithSourceComponent],
  templateUrl: './effect-prompt-dialog.component.html',
  styleUrl: './effect-prompt-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectPromptDialogComponent {
  protected readonly game = inject(GameStore);
  protected readonly prompt = inject<EffectPromptData>(DIALOG_DATA).prompt;

  protected readonly valid = new Set(this.prompt.validIds);
  protected readonly order = signal<CardSlot[]>([...this.prompt.cards]);
  /** Cards that do not meet the effect are hidden unless asked (all of them are needed to order the rest). */
  protected readonly showAll = signal(false);
  private readonly showsEverything = this.prompt.reorderRest || this.prompt.kind === 'CONFIRM';
  protected readonly shown = computed(() => (this.showAll() || this.showsEverything ? this.order() : this.order().filter((c) => this.valid.has(c.instanceId))));
  protected readonly hiddenCount = computed(() => (this.showsEverything ? 0 : this.prompt.cards.filter((c) => !this.valid.has(c.instanceId)).length));
  protected readonly chosen = signal<Set<string>>(new Set());
  protected readonly sending = signal(false);
  protected readonly canConfirm = computed(() => {
    const n = this.chosen().size;
    return !this.sending() && n >= this.prompt.min && n <= this.prompt.max;
  });

  /** Optional choices can be confirmed with nothing chosen ("No bloquear"). */
  protected readonly confirmLabel = computed(() => {
    if (this.chosen().size > 0 && this.prompt.purpose === 'RITUAL') return this.prompt.summonerId ? 'Invocar' : 'Continuar';
    if (this.chosen().size > 0 && this.prompt.purpose === 'SPECIAL') return this.prompt.chosenLabel === 'Material' ? 'Invocar' : 'Continuar';
    if (this.prompt.purpose === 'SPECIAL') return 'No invocar';
    if (this.chosen().size > 0 && this.prompt.purpose === 'PRIORITY') return 'Activar';
    if (this.prompt.purpose === 'ORDER') return 'Encadenar';
    if (this.prompt.purpose === 'REPLACE') return this.chosen().size > 0 ? 'Usar en su lugar' : 'No evitarlo';
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
    effect(() => this.game.promptChosen.set(new Set([...this.chosen()].map((id) => this.prompt.effects?.find((e) => this.effectKey(e) === id)?.sourceId ?? id))));
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

  /** What is answered to chain an offered effect. */
  protected effectKey(e: OfferedEffect): string {
    return e.effectId ?? e.sourceId;
  }

  protected cardOf(id: string): CardSlot | null {
    return this.prompt.cards.find((c) => c.instanceId === id) ?? null;
  }

  protected toggle(id: string): void {
    if (!this.valid.has(id) && !this.prompt.effects?.some((e) => this.effectKey(e) === id)) return;
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

  /** The effect of this choice is in the chain (its text is shown in the chain panel). */
  protected readonly inChain = computed(() => !!this.prompt.effectId && !!this.game.state()?.chain?.some((e) => e.id === this.prompt.effectId));

  /** What a chosen card shows: its chain link when ordering triggers, else what happens to it. */
  protected chosenTag(id: string): string {
    if (this.prompt.purpose === 'ORDER' || this.prompt.purpose === 'OPTIONAL') {
      // The real link it will take: after the links already in the chain
      const base = this.game.state()?.chain?.length ?? 0;
      const label = this.prompt.effects?.length ? null : this.prompt.cardLabels?.[id];
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
