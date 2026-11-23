import { CARD_IMAGES_CACHE, missingPictures } from './card-images';

/** A Cache Storage holding these responses under CARD_IMAGES_CACHE. */
function fakeCaches(entries: Record<string, Response>): CacheStorage {
  const cache = { match: async (url: string) => entries[url] } as unknown as Cache;
  return { open: async (name: string) => (name === CARD_IMAGES_CACHE ? cache : ({ match: async () => undefined } as unknown as Cache)) } as CacheStorage;
}

function opaque(): Response {
  const r = new Response(null);
  Object.defineProperty(r, 'type', { value: 'opaque' });
  return r;
}

describe('the kept card pictures', () => {
  const original = (globalThis as { caches?: CacheStorage }).caches;
  afterEach(() => {
    (globalThis as { caches?: CacheStorage }).caches = original;
  });

  it('finds the pictures not kept yet (an opaque one is kept)', async () => {
    (globalThis as { caches?: CacheStorage }).caches = fakeCaches({
      a: new Response('x', { headers: { 'content-length': '1000' } }),
      b: opaque(),
    });
    expect(await missingPictures(['a', 'b', 'c'])).toEqual(['c']);
  });
});
