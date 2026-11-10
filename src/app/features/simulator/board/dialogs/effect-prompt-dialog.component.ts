import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { DIALOG_DATA } from '@angular/cdk/dialog';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { fieldRows } from '@data/simulator/legal-actions';
import { CardSlot, EffectPrompt, OfferedEffect, ZONE_LABELS, ZONES } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { CardWithSourceComponent } from '@ui/domain/card-with-source/card-with-source.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { IconButtonComponent } from '@ui/primitives/icon-button/icon-button.component';
import { CardPeekComponent } from '../card-peek.component';
import { SheetComponent } from '@ui/surfaces/sheet/sheet.component';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { IconName } from '@ui/primitives/icon/icon.component';
import { EffectCardPanelComponent } from '../effect-card-panel.component';

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
  imports: [SheetComponent, GameCardComponent, StackComponent, ButtonComponent, IconComponent, CdkDropList, CdkDrag, CardWithSourceComponent, IconButtonComponent, EffectCardPanelComponent, NgTemplateOutlet, CardPeekComponent],
  templateUrl: './effect-prompt-dialog.component.html',
  styleUrl: './effect-prompt-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectPromptDialogComponent {
  protected readonly game = inject(GameStore);
  protected readonly prompt = inject<EffectPromptData>(DIALOG_DATA).prompt;

  protected readonly sheet = inject(SheetState);

  /**
   * The card beside the choice, with its effects and the one that asks lit up: the effect's card, or the card the
   * choice is about. Not when effects are offered to chain: each one is shown with its card in the choice itself.
   */
  protected readonly panel = computed(() => {
    if (this.prompt.effects?.length) return null;
    const link = this.prompt.effectId ? this.game.state()?.chain?.find((e) => e.id === this.prompt.effectId) : null;
    const slot = this.onTable(link?.sourceInstanceId ?? this.prompt.subjectId);
    if (!slot && !this.prompt.sourceImageUrl) return null;
    return { slot, name: this.prompt.sourceName || slot?.cardName || '', image: this.prompt.sourceImageUrl ?? null, text: this.prompt.effectText ?? link?.text ?? null };
  });
  /** A yes / no about the card already in the panel: the sheet does not show it again. */
  protected readonly cardsShown = computed(() => {
    const own = this.panel()?.slot?.instanceId;
    return !(this.prompt.kind === 'CONFIRM' && own && this.prompt.cards.every((c) => c.instanceId === own));
  });

  /** A choice with its card beside it, or with effects to chain, takes the wide sheet. */
  protected readonly withSource = !!this.prompt.sourceImageUrl || !!this.prompt.effects?.length;
  protected readonly valid = new Set(this.prompt.validIds);
  /** The most the chosen cards' levels may add up to, or null without that limit. */
  protected readonly levelSum = this.prompt.maxLevelSum ?? null;
  protected readonly order = signal<CardSlot[]>([...this.prompt.cards]);
  /** Cards that do not meet the effect are hidden unless asked (all of them are needed to order the rest). */
  protected readonly showAll = signal(false);
  private readonly showsEverything = this.prompt.reorderRest || this.prompt.kind === 'CONFIRM';
  /** The cards are only ordered, not picked: "al tope o al fondo" is answered with the buttons. */
  protected readonly orderOnly = !!this.prompt.topOrBottom;
  protected readonly shown = computed(() => (this.showAll() || this.showsEverything ? this.order() : this.order().filter((c) => this.valid.has(c.instanceId))));
  protected readonly hiddenCount = computed(() => (this.showsEverything ? 0 : this.prompt.cards.filter((c) => !this.valid.has(c.instanceId)).length));
  /**
   * Cards that must be chosen ("incluida esta carta"): they start chosen and stay so. Instead of the damage ("tributa
   * esta carta más 2 [retador]"), one of them is chosen first, and choosing none takes the damage.
   */
  private readonly required = new Set(this.prompt.requiredIds ?? []);
  private readonly oneRequiredFirst = this.prompt.purpose === 'DAMAGE_TRIBUTE' && this.required.size > 0;
  protected readonly chosen = signal<Set<string>>(new Set(this.oneRequiredFirst ? [] : this.required));
  private readonly requiredChosen = computed(() => [...this.required].some((id) => this.chosen().has(id)));
  protected readonly sending = signal(false);
  protected readonly canConfirm = computed(() => {
    const n = this.chosen().size;
    if (this.prompt.exactOrNone && n > 0 && n !== this.prompt.max) return false;
    if (this.oneRequiredFirst && n > 0 && !this.requiredChosen()) return false;
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
    if (this.prompt.reorderRest && this.prompt.max === 0) return 'Confirmar orden';
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

  /**
   * Where a card is now: the line of the field, or its zone (Mano, Tributos…), or the card it is attached to. A special
   * summon can take cards from several zones, so each one says where it comes from.
   */
  protected zoneOf(c: CardSlot): string | null {
    const players = Object.values(this.game.state()?.players ?? {});
    const field = players.find((p) => p.field.some((f) => f.instanceId === c.instanceId))?.field;
    if (field) return fieldRows(field).front.some((f) => f.instanceId === c.instanceId) ? 'Línea frontal' : 'Retaguardia';
    const host = this.hostOf(c);
    if (host) return `${host.materials.some((m) => m.instanceId === c.instanceId) ? 'Material' : 'Recurso'} de ${host.cardName ?? 'una carta'}`;
    for (const p of players) {
      const zone = ZONES.find((z) => z !== 'field' && p[z].some((x) => x.instanceId === c.instanceId));
      if (zone) return ZONE_LABELS[zone];
    }
    return null;
  }

  /**
   * The cards shown, boxed by the zone they come from (in the order they are shown), each box named; none when no
   * card's zone is known (cards looked at, out of any zone): then they go in one plain row.
   */
  protected readonly groups = computed(() => {
    const boxes: { zone: string; cards: CardSlot[] }[] = [];
    for (const c of this.shown()) {
      const zone = this.zoneOf(c) ?? 'Otras';
      const box = boxes.find((b) => b.zone === zone);
      if (box) box.cards.push(c);
      else boxes.push({ zone, cards: [c] });
    }
    return boxes.length === 1 && boxes[0].zone === 'Otras' ? [] : boxes;
  });

  /** The icon of a zone, beside its name. */
  protected zoneIcon(zone: string): IconName {
    if (zone === 'Línea frontal') return 'zone-front';
    if (zone === 'Retaguardia') return 'zone-rear';
    if (zone.startsWith('Material')) return 'layers';
    if (zone.startsWith('Recurso')) return 'sparkles';
    const icons: Record<string, IconName> = { Mano: 'zone-hand', Mazo: 'zone-deck', Vidas: 'zone-life', Tributos: 'zone-tribute', Descarte: 'zone-discard' };
    return icons[zone] ?? 'cards';
  }

  /** The card of the field a Material or Recurso belongs to (shown big, with it small at its corner), or null. */
  protected hostOf(c: CardSlot): CardSlot | null {
    for (const p of Object.values(this.game.state()?.players ?? {})) {
      const host = p.field.find((f) => f.materials.some((m) => m.instanceId === c.instanceId) || f.resources.some((r) => r.instanceId === c.instanceId));
      if (host) return host;
    }
    return null;
  }

  /** The levels of the cards chosen so far. */
  protected readonly chosenLevels = computed(() =>
    this.prompt.cards.filter((c) => this.chosen().has(c.instanceId)).reduce((sum, c) => sum + (c.level ?? 0), 0),
  );

  /** The levels already taken by the cards chosen ("con distinto nivel"). */
  private readonly takenLevels = computed(
    () => new Set(this.prompt.cards.filter((c) => this.chosen().has(c.instanceId)).map((c) => c.level ?? null)),
  );

  /**
   * It meets the effect and still fits with those already chosen: with a level-sum limit, within it; with "distinto
   * nivel", of a level not taken yet.
   */
  protected selectable(c: CardSlot): boolean {
    if (!this.valid.has(c.instanceId)) return false;
    // Its required card first (Estoque): the others wait for it
    if (this.oneRequiredFirst && !this.chosen().has(c.instanceId) && !this.required.has(c.instanceId) && !this.requiredChosen()) return false;
    if (this.prompt.distinctLevels && !this.chosen().has(c.instanceId) && this.takenLevels().has(c.level ?? null)) return false;
    const max = this.levelSum;
    return max === null || this.chosen().has(c.instanceId) || this.chosenLevels() + (c.level ?? 0) <= max;
  }

  private selectableId(id: string): boolean {
    const card = this.cardOf(id);
    return !!card && this.selectable(card);
  }

  /** What is answered to chain an offered effect. */
  protected effectKey(e: OfferedEffect): string {
    return e.effectId ?? e.sourceId;
  }

  protected cardOf(id: string): CardSlot | null {
    return this.prompt.cards.find((c) => c.instanceId === id) ?? null;
  }

  /** A card anywhere on the table (a zone, or attached to a card of the field), by its instance id. */
  private onTable(id: string | null | undefined): CardSlot | null {
    if (!id) return null;
    for (const p of Object.values(this.game.state()?.players ?? {})) {
      for (const zone of ZONES) {
        for (const c of p[zone]) {
          if (c.instanceId === id) return c;
          const attached = [...c.materials, ...c.resources].find((a) => a.instanceId === id);
          if (attached) return attached;
        }
      }
    }
    return this.cardOf(id);
  }

  protected toggle(id: string): void {
    if (this.prompt.effects?.length ? !this.prompt.effects.some((e) => this.effectKey(e) === id) : !this.selectableId(id)) return;
    if (this.required.has(id) && !this.oneRequiredFirst) return;
    const next = new Set(this.chosen());
    if (next.has(id)) next.delete(id);
    else if (next.size < this.prompt.max) next.add(id);
    else if (this.prompt.max === 1) {
      next.clear();
      next.add(id);
    }
    this.chosen.set(next);
  }

  /** The drop indexes are of the cards shown, which may leave out the ones that do not meet the effect. */
  protected reorder(event: CdkDragDrop<CardSlot[]>): void {
    const shown = this.shown();
    const list = [...this.order()];
    moveItemInArray(list, list.indexOf(shown[event.previousIndex]), list.indexOf(shown[event.currentIndex]));
    this.order.set(list);
  }

  /** The effect of this choice is in the chain (its text is shown in the chain panel). */
  protected readonly inChain = computed(() => !!this.prompt.effectId && !!this.game.state()?.chain?.some((e) => e.id === this.prompt.effectId));

  /** What a chosen card shows: its chain link when ordering triggers, else what happens to it. */
  /** An offered effect chosen: the link it will take ("Cadena 3"), or what choosing it does. */
  protected chosenTag(id: string): string {
    const n = this.chainNumber(id);
    return n ? `Cadena ${n}` : (this.prompt.chosenLabel ?? 'Elegida');
  }

  /** A card chosen to chain: the link it will take (after the links already in the chain); null for other choices. */
  protected chainNumber(id: string): number | null {
    if (this.prompt.purpose !== 'ORDER' && this.prompt.purpose !== 'OPTIONAL') return null;
    return (this.game.state()?.chain?.length ?? 0) + [...this.chosen()].indexOf(id) + 1;
  }

  /** CONFIRM prompts: choosing the card means yes. */
  protected answer(yes: boolean): void {
    this.sending.set(true);
    this.game.resolvePrompt(this.prompt.id, yes ? this.prompt.validIds.slice(0, 1) : []);
  }

  /** "al tope o al fondo": every card in the order set, sent where the player picked. */
  protected sendLooked(top: boolean): void {
    this.sending.set(true);
    this.game.resolvePrompt(this.prompt.id, top ? this.prompt.validIds.slice(0, 1) : [], this.order().map((c) => c.instanceId));
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
