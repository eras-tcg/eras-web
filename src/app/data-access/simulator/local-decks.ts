import { CardMeta, DriveCard } from '../cards/card.model';
import { Deck } from '../decks/deck.model';
import type { LocalDeckCard, LocalDeckSpec } from './engine-protocol';

/** vendor/eras-engine/starter-decks.json: ST1–ST4 as `LocalMatch` decks, each card's metadata (×3, the Iniciador ×1). */
export interface StarterDecksFile {
  format: string;
  decks: Record<string, { deckName: string; metadata: CardMeta[] }>;
}

/** The decks an offline game offers: what `LocalMatch` resolves by id, and the same decks as the pre-room lists them. */
export interface OfflineDecks {
  specs: Record<string, LocalDeckSpec>;
  list: Deck[];
}

/** The card API writes a missing name or edition as "" (DriveController's /cards/db): the server's own value is null. */
const value = (s: string | null | undefined): string | null => (s ? s : null);

/** How the server's DeckLoader finds a drive card's metadata: its name, lowercased, and its edition. */
const metaKey = (name: string, edition: string) => `${name.toLowerCase()}:${edition}`;

/** The metadata by that key; the first of two with the same key wins (DeckLoader's `toMap(…, (a, b) -> a)`). */
function metaIndex(meta: readonly CardMeta[]): Map<string, CardMeta> {
  const index = new Map<string, CardMeta>();
  for (const m of meta) {
    if (!m.cardName || !m.edition) continue;
    const key = metaKey(m.cardName, m.edition);
    if (!index.has(key)) index.set(key, m);
  }
  return index;
}

/**
 * A deck list of the site as `LocalMatch` plays it, as the server's `DeckLoader.slots` makes a room's cards: every
 * entry of `deck.cards` is a drive card's file id (the slot's `cardId`); its image is the drive card's `image_url`
 * (the server's `DriveCard.imageUrl`, which the card API sends as it is); its metadata is the one with the drive
 * card's name (case aside) and edition. The copies keep the list's order (runs of the same card are one entry with
 * their count). A card with no drive card or no metadata gets a bare metadata (its name only, if any): the server
 * seats it too, with no type, strength or effects.
 */
export function userDeckSpec(deck: Pick<Deck, 'deckName' | 'cards'>, images: readonly DriveCard[], meta: readonly CardMeta[]): LocalDeckSpec {
  const byId = new Map(images.map((d) => [d.id, d]));
  const index = metaIndex(meta);
  const cards: LocalDeckCard[] = [];
  for (const fileId of deck.cards) {
    const last = cards[cards.length - 1];
    if (last?.cardId === fileId) {
      last.copies++;
      continue;
    }
    const drive = byId.get(fileId);
    const name = value(drive?.name);
    const edition = value(drive?.edition);
    const found = name && edition ? index.get(metaKey(name, edition)) : undefined;
    cards.push({
      card: found ?? { id: fileId, cardName: name },
      copies: 1,
      cardId: fileId,
      imageUrl: drive ? value(drive.image_url) : null,
    });
  }
  return { deckName: deck.deckName, cards };
}

/**
 * A starter deck as `LocalMatch` plays it. With the card catalog at hand each card gets its drive card (the one with
 * its name and edition: what an ST deck list of the site holds), so it shows its image and has the id the site knows;
 * without it the file's own form stays (each card's metadata ×3, the Iniciador ×1; no images).
 */
export function starterDeckSpec(starter: { deckName: string; metadata: CardMeta[] }, images: readonly DriveCard[]): LocalDeckSpec {
  if (!images.length) return { deckName: starter.deckName, metadata: starter.metadata };
  const drives = new Map<string, DriveCard>();
  for (const d of images) {
    const name = value(d.name);
    const edition = value(d.edition);
    if (name && edition && !drives.has(metaKey(name, edition))) drives.set(metaKey(name, edition), d);
  }
  return {
    deckName: starter.deckName,
    cards: starter.metadata.map((m) => {
      const drive = m.cardName && m.edition ? drives.get(metaKey(m.cardName, m.edition)) : undefined;
      const copies = m.starter ? 1 : 3;
      return drive ? { card: m, copies, cardId: drive.id, imageUrl: value(drive.image_url) } : { card: m, copies, cardId: m.id };
    }),
  };
}

/** A deck spec as the pre-room lists it: one card id per copy, its cover the Iniciador's image (or the deck's own). */
function listed(id: string, spec: LocalDeckSpec, cover: string | null): Deck {
  const entries =
    'cards' in spec
      ? spec.cards.map((c) => ({ id: c.cardId ?? (c.card as CardMeta).id, copies: c.copies, image: c.imageUrl ?? null, starter: !!(c.card as CardMeta).starter }))
      : spec.metadata.map((m) => ({ id: (m as CardMeta).id, copies: (m as CardMeta).starter ? 1 : 3, image: null, starter: !!(m as CardMeta).starter }));
  return {
    id,
    deckName: spec.deckName,
    cards: entries.flatMap((e) => Array<string>(e.copies).fill(e.id)),
    deckImage: cover ?? entries.find((e) => e.starter && e.image)?.image ?? null,
  };
}

/**
 * The decks of an offline game: the starter decks always (by their file's ids, "deck-st1"…), then the player's own
 * decks with cards, when they and the card catalog are loaded (by their ids, as online).
 */
export function offlineDecks(input: {
  starters: StarterDecksFile | null;
  mine: readonly Deck[];
  images: readonly DriveCard[];
  meta: readonly CardMeta[];
}): OfflineDecks {
  const specs: Record<string, LocalDeckSpec> = {};
  const list: Deck[] = [];
  for (const [id, starter] of Object.entries(input.starters?.decks ?? {})) {
    specs[id] = starterDeckSpec(starter, input.images);
    list.push(listed(id, specs[id], null));
  }
  if (input.images.length && input.meta.length) {
    for (const deck of input.mine) {
      if (!deck.cards.length || specs[deck.id]) continue;
      specs[deck.id] = userDeckSpec(deck, input.images, input.meta);
      list.push({ ...listed(deck.id, specs[deck.id], deck.deckImage ?? null), userId: deck.userId, username: deck.username, privateDeck: deck.privateDeck });
    }
  }
  return { specs, list };
}

/**
 * The part of the card catalog `offlineDecks` reads for these decks: the drive cards the decks list (by file id) and
 * those a starter deck's card finds by name and edition, with the metadata of the same name and edition. What is kept
 * on the device for playing without the connection (offline-library.ts): the same decks come out of it as out of
 * the whole catalog.
 */
export function catalogSubset(input: {
  starters: StarterDecksFile | null;
  mine: readonly Pick<Deck, 'cards'>[];
  images: readonly DriveCard[];
  meta: readonly CardMeta[];
}): { images: DriveCard[]; meta: CardMeta[] } {
  const used = new Set(input.mine.flatMap((d) => d.cards));
  const starterKeys = new Set<string>();
  for (const starter of Object.values(input.starters?.decks ?? {})) {
    for (const m of starter.metadata) if (m.cardName && m.edition) starterKeys.add(metaKey(m.cardName, m.edition));
  }
  const images = input.images.filter((d) => {
    if (used.has(d.id)) return true;
    const name = value(d.name);
    const edition = value(d.edition);
    return !!name && !!edition && starterKeys.has(metaKey(name, edition));
  });
  const keys = new Set(images.flatMap((d) => (value(d.name) && value(d.edition) ? [metaKey(d.name as string, d.edition)] : [])));
  const meta = input.meta.filter((m) => !!m.cardName && !!m.edition && keys.has(metaKey(m.cardName, m.edition)));
  return { images, meta };
}

/** Every picture an offline game with these decks can show: each card's and each deck's cover (no repeats). */
export function offlinePictures(decks: OfflineDecks): string[] {
  const urls = new Set<string>();
  for (const spec of Object.values(decks.specs)) {
    if ('cards' in spec) for (const c of spec.cards) if (c.imageUrl) urls.add(c.imageUrl);
  }
  for (const deck of decks.list) if (deck.deckImage) urls.add(deck.deckImage);
  return [...urls];
}
