import { CARD_IMAGES_CACHE, ESTIMATED_PICTURE_BYTES, keptPictureSizes, missingPictures } from './card-images';

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

  it('measures readable pictures by their length and opaque ones by the usual picture size', async () => {
    (globalThis as { caches?: CacheStorage }).caches = fakeCaches({
      a: new Response('x', { headers: { 'content-length': '1000' } }),
      b: opaque(),
    });
    expect(await keptPictureSizes(['a', 'b', 'c'])).toEqual({ bytes: 1000 + ESTIMATED_PICTURE_BYTES, opaque: 1 });
    expect(await missingPictures(['a', 'b', 'c'])).toEqual(['c']);
  });

  it('counts nothing when no picture is kept', async () => {
    (globalThis as { caches?: CacheStorage }).caches = fakeCaches({});
    expect(await keptPictureSizes(['a'])).toEqual({ bytes: 0, opaque: 0 });
  });
});
