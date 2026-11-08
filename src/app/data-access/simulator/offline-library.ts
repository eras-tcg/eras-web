import { KeyValueStore, erasStore } from '@core/storage/kv-store';
import { CardMeta, DriveCard } from '../cards/card.model';
import { Deck } from '../decks/deck.model';
import { StarterDecksFile, catalogSubset } from './local-decks';

/**
 * A player's decks as they were last loaded with the connection, and the part of the card catalog they (and the
 * starter decks) need: what "Modo solo sin conexión" offers after a reload or an offline start.
 */
export interface StoredLibrary {
  userId: string;
  savedAt: number;
  decks: Deck[];
  images: DriveCard[];
  meta: CardMeta[];
}

/** Every player's library lives under its own key; signing out deletes them all. */
const USER_PREFIX = 'offline-library:';
const keyOf = (userId: string) => USER_PREFIX + userId;

/** What is saved for a player: their decks and the catalog's part those and the starter decks read. */
export function libraryRecord(
  userId: string,
  data: { decks: readonly Deck[]; images: readonly DriveCard[]; meta: readonly CardMeta[]; starters: StarterDecksFile | null },
  now = Date.now(),
): StoredLibrary {
  const subset = catalogSubset({ starters: data.starters, mine: data.decks, images: data.images, meta: data.meta });
  return { userId, savedAt: now, decks: [...data.decks], ...subset };
}

/** The decks and cards kept on this device (IndexedDB) for playing without the connection, one record per player. */
export class OfflineLibrary {
  constructor(private readonly store: KeyValueStore = erasStore) {}

  async load(userId: string): Promise<StoredLibrary | null> {
    const record = await this.store.get<StoredLibrary>(keyOf(userId));
    return record && record.userId === userId ? record : null;
  }

  save(record: StoredLibrary): Promise<void> {
    return this.store.set(keyOf(record.userId), record);
  }

  /** Signing out: no player's decks stay on the device. */
  clear(): Promise<void> {
    return this.store.deletePrefix(USER_PREFIX);
  }
}

export const offlineLibrary = new OfflineLibrary();
