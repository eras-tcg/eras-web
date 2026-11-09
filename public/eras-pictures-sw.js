/*
 * ERAS card pictures' service worker: the card pictures come from the image host (another origin); they are kept in
 * a cache, so a game without the connection shows them. Imported by eras-sw.js (the site and the installed PWA, with
 * Angular's ngsw) and registered alone by the Android app (its code is in the APK: no ngsw there).
 *
 * - Only cross-origin GET requests for an <img> (destination "image") are handled here; everything else, the API,
 *   the socket and the login included, goes on (to ngsw, which caches none of it: ngsw-config.json has no data
 *   groups; in the Android app, to the network or the APK).
 * - Cache first: a card picture's URL changes when the picture does (?v=upload time), so what is kept stays right.
 * - It asks the host with CORS first (a readable response: its real size counts against the quota) and, if the host
 *   does not allow it, as a plain <img> would (an opaque response, which <img> can still show).
 * - At most MAX_ENTRIES pictures: past that the oldest saved go first.
 *
 * The page writes to the same cache ("Descargar para jugar sin conexión", card-images.ts): keep CARD_IMAGES in sync.
 */
const CARD_IMAGES = 'eras-card-images-v1';
const MAX_ENTRIES = 1500;
/** Hosts known not to answer CORS: asked straight as a plain <img> from then on. */
const noCors = new Set();

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.destination !== 'image') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin || (url.protocol !== 'https:' && url.protocol !== 'http:')) return;
  event.respondWith(cardImage(request, event));
  // ngsw's own listener (added after this one, in eras-sw.js) must not answer it too
  event.stopImmediatePropagation();
});

async function cardImage(request, event) {
  const cache = await caches.open(CARD_IMAGES);
  const kept = await cache.match(request.url, { ignoreVary: true });
  if (kept) return kept;
  const response = await fetchImage(request);
  if (response.ok || response.type === 'opaque') {
    event.waitUntil(
      cache
        .put(request.url, response.clone())
        .then(() => trim(cache))
        .catch(() => undefined),
    );
  }
  return response;
}

async function fetchImage(request) {
  const origin = new URL(request.url).origin;
  if (request.mode !== 'cors' && !noCors.has(origin)) {
    try {
      const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
      if (response.ok) return response;
    } catch {
      noCors.add(origin);
    }
  }
  try {
    return await fetch(request);
  } catch {
    return Response.error();
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) await cache.delete(keys[i]);
}
