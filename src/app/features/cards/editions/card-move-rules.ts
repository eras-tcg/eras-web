import { CardMeta } from '@data/cards/card.model';

/** A card and the slot it goes to (its color stays). */
export interface CardMove {
  id: string;
  edition: string;
  subEdition: string | null;
  cardNumber: number;
}

/** The moves of a chain so far and the card still waiting for a slot (null: the chain is done). */
export interface MoveChain {
  moves: CardMove[];
  hand: CardMeta | null;
}

/** "E1.1" → edition "E1", sub-edition "1"; "E2" → no sub-edition. */
export function splitEdition(editionId: string): { edition: string; subEdition: string | null } {
  const [edition, sub] = editionId.split('.');
  return { edition, subEdition: sub || null };
}

/**
 * The cards as the chain leaves them: each moved card at its last slot, and the card in hand out of every slot (the
 * place it left is free while it waits).
 */
export function chainMetas(metas: readonly CardMeta[], chain: MoveChain): CardMeta[] {
  const last = new Map(chain.moves.map((m) => [m.id, m]));
  return metas
    .filter((m) => m.id !== chain.hand?.id)
    .map((m) => {
      const mv = last.get(m.id);
      return mv ? { ...m, edition: mv.edition, subEdition: mv.subEdition, cardNumber: mv.cardNumber } : m;
    });
}

/**
 * The card in hand goes to a slot. An empty slot ends the chain; a slot with a card (`occupant`, already confirmed)
 * hands that card over to be placed next.
 */
export function placeInSlot(chain: MoveChain, editionId: string, cardNumber: number, occupant: CardMeta | null): MoveChain {
  if (!chain.hand) return chain;
  const { edition, subEdition } = splitEdition(editionId);
  const move: CardMove = { id: chain.hand.id, edition, subEdition, cardNumber };
  return { moves: [...chain.moves, move], hand: occupant };
}

/** What to save: each card's last slot, leaving out the cards that end where they started. */
export function finalMoves(chain: MoveChain, original: readonly CardMeta[]): CardMove[] {
  const byId = new Map(original.map((m) => [m.id, m]));
  const last = new Map(chain.moves.map((m) => [m.id, m]));
  return [...last.values()].filter((m) => {
    const o = byId.get(m.id);
    return !o || o.edition !== m.edition || (o.subEdition || null) !== m.subEdition || o.cardNumber !== m.cardNumber;
  });
}

/** "E1.1-B05": a slot's code. */
export function slotCode(edition: string, subEdition: string | null | undefined, color: string, cardNumber: number): string {
  return `${edition}${subEdition ? '.' + subEdition : ''}-${color.toUpperCase()}${String(cardNumber).padStart(2, '0')}`;
}
