import 'fake-indexeddb/auto';
import { KeyValueStore } from '@core/storage/kv-store';
import { CardMeta, DriveCard } from '../cards/card.model';
import { Deck } from '../decks/deck.model';
import { StarterDecksFile, catalogSubset, offlineDecks, offlinePictures } from './local-decks';
import { OfflineLibrary, libraryRecord } from './offline-library';
import { chooseSources } from './offline-game';

const drive = (id: string, name: string, edition: string): DriveCard => ({
  id,
  name,
  edition,
  sub_edition: '',
  number: 1,
  color_identity: 'B',
  image_url: `https://img.example/${id}.jpg?v=1`,
  time_stamp: '',
});
const meta = (id: string, cardName: string, edition: string, extra: Partial<CardMeta> = {}): CardMeta => ({ id, cardName, edition, ...extra });

const images = [drive('f-a', 'Alfa', 'E1'), drive('f-b', 'Beta', 'E1'), drive('f-st', 'Iniciador', 'ST1'), drive('f-z', 'Zeta', 'E2')];
const metas = [meta('m-a', 'alfa', 'E1'), meta('m-b', 'Beta', 'E1'), meta('m-st', 'Iniciador', 'ST1', { starter: true }), meta('m-z', 'Zeta', 'E2')];
const starters: StarterDecksFile = { format: 'x', decks: { 'deck-st1': { deckName: 'ST1', metadata: [metas[2]] } } };
const mine: Deck[] = [{ id: 'd1', deckName: 'Mío', cards: ['f-a', 'f-a', 'f-b'], userId: 'u1' }];

describe('catalogSubset', () => {
  it('keeps the drive cards the decks list and those of the starter decks, with their metadata', () => {
    const subset = catalogSubset({ starters, mine, images, meta: metas });
    expect(subset.images.map((d) => d.id)).toEqual(['f-a', 'f-b', 'f-st']);
    expect(subset.meta.map((m) => m.id)).toEqual(['m-a', 'm-b', 'm-st']);
  });

  it('makes the same offline decks as the whole catalog', () => {
    const subset = catalogSubset({ starters, mine, images, meta: metas });
    expect(offlineDecks({ starters, mine, ...subset })).toEqual(offlineDecks({ starters, mine, images, meta: metas }));
  });
});

describe('offlinePictures', () => {
  it('lists each card picture and deck cover once', () => {
    const decks = offlineDecks({ starters, mine: [{ ...mine[0], deckImage: 'https://img.example/cover.jpg' }], images, meta: metas });
    expect(offlinePictures(decks).sort()).toEqual(
      ['https://img.example/cover.jpg', 'https://img.example/f-a.jpg?v=1', 'https://img.example/f-b.jpg?v=1', 'https://img.example/f-st.jpg?v=1'].sort(),
    );
  });
});

describe('OfflineLibrary (IndexedDB)', () => {
  let store: KeyValueStore;
  let library: OfflineLibrary;
  let n = 0;

  beforeEach(() => {
    store = new KeyValueStore(`library-test-${++n}`);
    library = new OfflineLibrary(store);
  });

  afterEach(() => store.close());

  it('keeps each player decks under their own id, and a reload finds them', async () => {
    await library.save(libraryRecord('u1', { decks: mine, images, meta: metas, starters }, 1000));
    await library.save(libraryRecord('u2', { decks: [], images, meta: metas, starters }, 2000));
    await store.close();
    const again = new OfflineLibrary(store);
    const u1 = await again.load('u1');
    expect(u1?.decks).toEqual(mine);
    expect(u1?.savedAt).toBe(1000);
    expect(u1?.images.map((d) => d.id)).toEqual(['f-a', 'f-b', 'f-st']);
    expect((await again.load('u2'))?.decks).toEqual([]);
    expect(await again.load('u3')).toBeNull();
  });

  it('signing out deletes every player library (and nothing else)', async () => {
    await store.set('other', 1);
    await library.save(libraryRecord('u1', { decks: mine, images, meta: metas, starters }));
    await library.save(libraryRecord('u2', { decks: mine, images, meta: metas, starters }));
    await library.clear();
    expect(await library.load('u1')).toBeNull();
    expect(await library.load('u2')).toBeNull();
    expect(await store.get('other')).toBe(1);
  });
});

describe('chooseSources (what an offline game offers)', () => {
  const stored = libraryRecord('u1', { decks: mine, images, meta: metas, starters }, 5);
  const empty = { decks: [], decksOwner: null, images: [], meta: [] };

  it('a reload or an offline start: the decks and cards kept on the device', () => {
    const s = chooseSources({ starters, userId: 'u1', live: empty, stored });
    expect(s.mine).toEqual(mine);
    expect(s.images).toEqual(stored.images);
    expect(s.fromDevice).toBe(true);
    expect(s.savedAt).toBe(5);
    expect(offlineDecks(s).list.map((d) => d.id)).toEqual(['deck-st1', 'd1']);
  });

  it('loaded in this visit: the live ones', () => {
    const live = { decks: [{ ...mine[0], deckName: 'Nuevo' }], decksOwner: 'u1', images, meta: metas };
    const s = chooseSources({ starters, userId: 'u1', live, stored });
    expect(s.mine[0].deckName).toBe('Nuevo');
    expect(s.images).toBe(images);
    expect(s.fromDevice).toBe(false);
  });

  it('never another player decks', () => {
    const s = chooseSources({ starters, userId: 'u2', live: { ...empty, decks: mine, decksOwner: 'u1' }, stored });
    expect(s.mine).toEqual([]);
    expect(offlineDecks(s).list.map((d) => d.id)).toEqual(['deck-st1']);
  });
});
