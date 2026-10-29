import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardMeta } from '@data/cards/card.model';
import { CardsStore } from '@data/cards/cards.store';
import { CardFilter, EffectAction, EffectText, cardEffectTexts, filterLabel, matchesFilter } from '@data/simulator/effect-actions';
import { GameStore } from '@data/simulator/game.store';
import { displayStrength, sharedIndexForValue, sharedValueForIndex } from '@data/simulator/game-rules';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardPickerData, CardPickerDialogComponent } from './dialogs/card-picker-dialog.component';
import { BoardDialogs } from './board-dialogs';

/** Kinds the board can carry out; the others ("daño directo") are only shown as text. */
const RUNNABLE = new Set<EffectAction['kind']>([
  'mill',
  'draw',
  'handToTributes',
  'handToDeckTop',
  'takeFromTributes',
  'lookTop',
  'tributesToDeckBottom',
  'tributesToDeckTop',
  'reduceStrength',
  'gainStrength',
  'destroy',
  'untapSelf',
  'untapAlly',
  'gainGem',
  'deckTopToLife',
  'summon',
  'materialsToTributes',
  'sacrifice',
  'destroyLife',
]);

/** Where the effect comes from: one of your cards. */
export interface EffectSource {
  instanceId: string;
  zone: ZoneName;
}

/**
 * Assisted effects (level 1): reads a card's effects and carries out the basic actions they mention with
 * the regular game actions. The player triggers each action and makes every choice in a picker.
 */
@Injectable()
export class BoardEffects {
  private readonly game = inject(GameStore);
  private readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);
  private readonly dialogs = inject(BoardDialogs);

  private readonly metaById = computed(() => new Map(this.cards.cards().map((c) => [c.id, c.meta])));

  meta(slot: CardSlot): CardMeta | null {
    return this.metaById().get(slot.cardId) ?? null;
  }

  /** Effects of one of your cards; on the field it also offers what its materials pass on. */
  effects(slot: CardSlot, zone: ZoneName): EffectText[] {
    const under = zone === 'field' ? slot.materials.map((m) => this.meta(m)) : [];
    return cardEffectTexts(this.meta(slot), under);
  }

  runnable(action: EffectAction): boolean {
    return RUNNABLE.has(action.kind);
  }

  /** Finds a card of yours by instance id, in any zone. */
  find(instanceId: string): { slot: CardSlot; zone: ZoneName } | null {
    const me = this.game.myState();
    if (!me) return null;
    for (const zone of ['field', 'hand', 'tributeZone', 'discardPile', 'deck', 'lifeStack'] as ZoneName[]) {
      const slot = (me[zone] as CardSlot[]).find((c) => c.instanceId === instanceId);
      if (slot) return { slot, zone };
    }
    return null;
  }

  /** Carries out one action. Resolves false when the player cancelled a choice. */
  async run(action: EffectAction, source: EffectSource): Promise<boolean> {
    const me = this.game.myState();
    const opp = this.game.opponentState();
    if (!me) return false;
    const oppId = opp?.userId ?? null;

    switch (action.kind) {
      case 'mill':
        for (const c of me.deck.slice(0, action.count)) this.game.moveCard(c.instanceId, 'deck', 'tributeZone');
        return true;
      case 'draw':
        for (let i = 0; i < Math.min(action.count, me.deck.length); i++) this.game.drawCard();
        return true;
      case 'handToTributes':
        return this.pickAndMove(me.hand, action.count, !action.upTo, 'Tributar de la mano', 'hand', 'tributeZone');
      case 'handToDeckTop':
        return this.pickAndMove(me.hand, action.count, !action.upTo, 'Poner en el tope del mazo', 'hand', 'deck', { toPosition: 'top' });
      case 'takeFromTributes':
        return this.pickAndMove(me.tributeZone, action.count, !action.upTo, 'Tomar de tributos', 'tributeZone', 'hand', {}, action.filter);
      case 'tributesToDeckTop':
        return this.pickAndMove(me.tributeZone, action.count, false, 'Tributos al tope del mazo', 'tributeZone', 'deck', { toPosition: 'top' });
      case 'lookTop':
        this.dialogs.deckPeek('top', Math.min(action.look, me.deck.length));
        return true;
      case 'tributesToDeckBottom': {
        const ids = await this.pick({ title: 'Tributos al fondo del mazo', cards: me.tributeZone, max: action.count, exact: true, ...this.filtered(action.filter) });
        if (!ids) return false;
        this.game.bulkToDeckBottom('tributeZone', ids, false);
        return true;
      }
      case 'reduceStrength': {
        const enemies = frontLine(opp?.field ?? []);
        const targets = action.all ? enemies.map((c) => c.instanceId) : await this.pick({ title: `Reducir ${action.amount} la fuerza`, cards: enemies, max: 1, exact: true });
        if (!targets) return false;
        // Strength reduced to 0: the server destroys it (rule 12.0.0.2)
        for (const id of targets) this.game.modifyStrength(id, -action.amount, oppId);
        return true;
      }
      case 'gainStrength':
        this.game.modifyStrength(source.instanceId, action.amount);
        return true;
      case 'destroy': {
        const ids = await this.pick({
          title: 'Destruir enemigo',
          cards: frontLine(opp?.field ?? []),
          max: action.count,
          exact: !action.upTo,
          ...this.filtered(action.filter, true),
        });
        if (!ids) return false;
        for (const id of ids) this.game.destroyCard(id, oppId);
        return true;
      }
      case 'untapSelf': {
        const found = this.find(source.instanceId);
        if (found?.slot.tapped) this.game.tapCard(source.instanceId, found.zone);
        return true;
      }
      case 'untapAlly': {
        const ids = await this.pick({ title: 'Reactivar aliado', cards: me.field.filter((c) => c.tapped), max: 1, exact: true, ...this.filtered(action.filter) });
        if (!ids) return false;
        for (const id of ids) this.game.tapCard(id, 'field');
        return true;
      }
      case 'gainGem': {
        // Gems are the shared Contador (10…0…10), not the 0–5 Marcador (rules 4.0.9 and 5): moves it towards you
        const first = this.game.isFirstPlayer();
        const index = sharedIndexForValue(this.game.state()?.sharedCounter ?? 0, first);
        const next = Math.max(0, Math.min(20, index - action.count));
        this.game.setCounter(sharedValueForIndex(next, first));
        return true;
      }
      case 'deckTopToLife': {
        const top = me.deck[0];
        if (top) this.game.moveCard(top.instanceId, 'deck', 'lifeStack', { toPosition: 'top', faceDown: !action.faceUp });
        return true;
      }
      case 'summon': {
        const pool = action.from === 'hand' ? me.hand : me.tributeZone;
        const ids = await this.pick({ title: `Invocar de ${action.from === 'hand' ? 'la mano' : 'tributos'}`, cards: pool, max: action.count, ...this.filtered(action.filter) });
        if (!ids) return false;
        // Summoned by effect: into the Retaguardia (rule 4.0.6.1), with the regulatory draw (rule 9.1.0.4)
        ids.forEach((id, i) => {
          this.game.moveCard(id, action.from, 'field', { x: 35 + i * 15, y: 75 });
          if (me.deck.length > i) this.game.drawCard();
        });
        return true;
      }
      case 'materialsToTributes': {
        const parent = this.find(source.instanceId);
        const materials = parent?.slot.materials ?? [];
        const ids = await this.pick({ title: 'Tributar materiales', cards: materials, max: action.count, exact: !action.upTo });
        if (!ids) return false;
        for (const id of ids) this.game.moveFromAttachment({ instanceId: id, attachmentOf: source.instanceId, attachmentType: 'materials', toZone: 'tributeZone' });
        return true;
      }
      case 'sacrifice': {
        const ids = await this.pick({ title: 'Sacrificar aliado', cards: me.field, max: 1, exact: true });
        if (!ids) return false;
        for (const id of ids) this.game.sacrificeCard(id);
        return true;
      }
      case 'destroyLife': {
        const ids = await this.pick({ title: 'Destruir vida boca arriba', cards: (opp?.lifeStack ?? []).filter((c) => !c.faceDown), max: 1, exact: true });
        if (!ids) return false;
        for (const id of ids) this.game.moveCard(id, 'lifeStack', 'discardPile', { targetPlayerId: oppId });
        return true;
      }
      default:
        return false;
    }
  }

  private async pick(data: CardPickerData): Promise<string[] | undefined> {
    const ref = this.modal.sheet<string[], CardPickerData>(CardPickerDialogComponent, { data });
    const ids = await firstValueFrom(ref.closed);
    return ids && ids.length ? ids : undefined;
  }

  private async pickAndMove(
    cards: readonly CardSlot[],
    count: number,
    exact: boolean,
    title: string,
    from: ZoneName,
    to: ZoneName,
    opts: { toPosition?: 'top' | 'bottom' } = {},
    filter?: CardFilter,
  ): Promise<boolean> {
    const ids = await this.pick({ title, cards, max: count, exact: exact && cards.length >= count, ...(filter ? this.filtered(filter) : {}) });
    if (!ids) return false;
    for (const id of ids) this.game.moveCard(id, from, to, opts);
    return true;
  }

  /** Picker options for a filter: matching cards first, the rest on request. Field cards use their current strength. */
  private filtered(filter: CardFilter, onField = false): Pick<CardPickerData, 'matches' | 'filterLabel'> {
    const label = filterLabel(filter);
    if (!label) return {};
    return {
      filterLabel: label,
      matches: (slot) => {
        const meta = this.meta(slot);
        return matchesFilter(
          {
            colorIdentity: meta?.colorIdentity,
            colors: meta?.colors,
            classes: meta?.cardClasses,
            level: meta?.level,
            strength: onField ? displayStrength(slot) : (meta?.strength ?? slot.strength),
          },
          filter,
        );
      },
    };
  }
}

/**
 * Enemies an effect can choose: the Retaguardia cannot be targeted by the opponent's effects (rule 4.0.6.3).
 * Field y is stored from the owner's view, where the front line is the upper half.
 */
function frontLine(slots: readonly CardSlot[]): CardSlot[] {
  return slots.filter((c) => (c.y ?? 0) < 50);
}
