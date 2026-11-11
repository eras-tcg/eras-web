import { Deck } from './deck.model';
import { DeckBox } from './deckbox.model';

/** Longest deckbox name (same as a deck name; DriveManager checks it too). */
export const DECKBOX_NAME_MAX = 30;
/** Most deckboxes a player may have (DriveManager checks it too). */
export const DECKBOX_MAX = 50;

/** Drag data types: a deck dragged into a deckbox, a deckbox dragged to another place. */
export const DRAG_DECK = 'application/x-eras-deck';
export const DRAG_DECKBOX = 'application/x-eras-deckbox';

/** CSS color of a deckbox (a design token). */
export function deckBoxColor(box: Pick<DeckBox, 'color'>): string {
  return `var(--color-deckbox-${box.color})`;
}

/** The deckbox that holds a deck, or null when it is loose. */
export function boxOf(deckId: string, boxes: readonly DeckBox[]): DeckBox | null {
  return boxes.find((b) => b.deckIds.includes(deckId)) ?? null;
}

/** The decks in no deckbox. */
export function looseDecks(decks: readonly Deck[], boxes: readonly DeckBox[]): Deck[] {
  const boxed = new Set(boxes.flatMap((b) => b.deckIds));
  return decks.filter((d) => !boxed.has(d.id));
}

/** A deckbox's decks, in the order they went in (ids of deleted decks are skipped). */
export function decksIn(box: DeckBox, decks: readonly Deck[]): Deck[] {
  const byId = new Map(decks.map((d) => [d.id, d]));
  return box.deckIds.map((id) => byId.get(id)).filter((d): d is Deck => !!d);
}

/** The deckboxes after putting a deck in one (null: loose): out of any other, last in the new one. */
export function withDeckIn(boxes: readonly DeckBox[], deckId: string, boxId: string | null): DeckBox[] {
  return boxes.map((b) => {
    const has = b.deckIds.includes(deckId);
    if (b.id === boxId) return has ? b : { ...b, deckIds: [...b.deckIds, deckId] };
    return has ? { ...b, deckIds: b.deckIds.filter((id) => id !== deckId) } : b;
  });
}

/** The ids in order after dropping one deckbox on another: it takes that one's place. */
export function dropBoxOn(boxes: readonly DeckBox[], draggedId: string, targetId: string): string[] {
  const ids = boxes.map((b) => b.id);
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return ids;
  ids.splice(from, 1);
  ids.splice(to, 0, draggedId);
  return ids;
}

/** The ids in order after moving one deckbox a step back (-1) or forward (+1); unchanged at either end. */
export function moveBox(boxes: readonly DeckBox[], id: string, step: -1 | 1): string[] {
  const ids = boxes.map((b) => b.id);
  const from = ids.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

/** A name cleaned like the server does (trimmed, single spaces). */
export function cleanBoxName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Why a deckbox name is not accepted, or null (empty, too long, or already used by another of the player's). */
export function boxNameError(name: string, boxes: readonly DeckBox[], selfId: string | null = null): string | null {
  const clean = cleanBoxName(name);
  if (!clean) return 'Escribe un nombre';
  if (clean.length > DECKBOX_NAME_MAX) return `Hasta ${DECKBOX_NAME_MAX} caracteres`;
  const lower = clean.toLowerCase();
  if (boxes.some((b) => b.id !== selfId && b.name.toLowerCase() === lower)) return 'Ya tienes una deckbox con ese nombre';
  return null;
}
