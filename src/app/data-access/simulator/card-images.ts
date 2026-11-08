/**
 * The card pictures kept for playing without the connection, in the same cache the service worker fills as cards are
 * seen (public/eras-pictures-sw.js: keep the name in sync). The image host is another origin: each picture is asked with CORS
 * first (a readable response, its size known) and, if the host does not allow it, as a plain <img> would (an opaque
 * response: <img> shows it, its size is unknown and browsers count it bigger against the quota).
 */
export const CARD_IMAGES_CACHE = 'eras-card-images-v1';

/** A guess of a card picture's size before any is downloaded (the real average replaces it as they arrive). */
export const ESTIMATED_PICTURE_BYTES = 180 * 1024;
/** Pictures downloaded at the same time. */
const PARALLEL = 4;

export interface PictureProgress {
  done: number;
  total: number;
  failed: number;
  /** Bytes of the pictures whose size is known (CORS responses). */
  bytes: number;
  /** How many pictures `bytes` counts. */
  measured: number;
}

/** Whether this browser can keep pictures (Cache API: secure contexts only). */
export function canKeepPictures(): boolean {
  return typeof caches !== 'undefined';
}

/** Which of these pictures are not kept yet. */
export async function missingPictures(urls: readonly string[]): Promise<string[]> {
  if (!canKeepPictures() || !urls.length) return [...urls];
  const cache = await caches.open(CARD_IMAGES_CACHE);
  const kept = await Promise.all(urls.map((url) => cache.match(url, { ignoreVary: true })));
  return urls.filter((_, i) => !kept[i]);
}

/**
 * What the kept pictures really take: the size of those whose host allowed reading them, and how many are opaque
 * (no CORS on the image host). The browser counts each opaque one as several megabytes of quota, far more than the
 * picture; for those the usual picture size is the estimate.
 */
export async function keptPictureSizes(urls: readonly string[]): Promise<{ bytes: number; opaque: number }> {
  if (!canKeepPictures() || !urls.length) return { bytes: 0, opaque: 0 };
  const cache = await caches.open(CARD_IMAGES_CACHE);
  const kept = await Promise.all(urls.map((url) => cache.match(url, { ignoreVary: true })));
  let bytes = 0;
  let opaque = 0;
  for (const response of kept) {
    if (!response) continue;
    if (response.type === 'opaque') {
      opaque++;
      bytes += ESTIMATED_PICTURE_BYTES;
    } else {
      bytes += Number(response.headers.get('content-length')) || ESTIMATED_PICTURE_BYTES;
    }
  }
  return { bytes, opaque };
}

/** The total size to show: the measured average for every picture (or the guess until one is measured). */
export function estimateBytes(count: number, progress: Pick<PictureProgress, 'bytes' | 'measured'> | null = null): number {
  const average = progress && progress.measured > 0 ? progress.bytes / progress.measured : ESTIMATED_PICTURE_BYTES;
  return Math.round(count * average);
}

const noCorsHosts = new Set<string>();

async function fetchPicture(url: string, signal: AbortSignal): Promise<{ response: Response; bytes: number | null }> {
  const origin = new URL(url, document.baseURI).origin;
  if (!noCorsHosts.has(origin)) {
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal });
      if (response.ok) {
        const blob = await response.clone().blob();
        return { response, bytes: blob.size };
      }
    } catch (e) {
      if (signal.aborted) throw e;
      noCorsHosts.add(origin);
    }
  }
  const response = await fetch(url, { mode: 'no-cors', credentials: 'omit', signal });
  if (!response.ok && response.type !== 'opaque') throw new Error(`${url}: ${response.status}`);
  return { response, bytes: null };
}

/**
 * Downloads and keeps the pictures not kept yet, a few at a time, telling the progress after each. Stops (rejecting
 * with an AbortError) when the signal is aborted; what was downloaded until then stays. A picture that fails is
 * counted and skipped.
 */
export async function keepPictures(urls: readonly string[], options: { signal: AbortSignal; progress?: (p: PictureProgress) => void }): Promise<PictureProgress> {
  const { signal } = options;
  const state: PictureProgress = { done: 0, total: urls.length, failed: 0, bytes: 0, measured: 0 };
  if (!canKeepPictures()) throw new Error('Este navegador no permite guardar las imágenes');
  const cache = await caches.open(CARD_IMAGES_CACHE);
  const queue = [...urls];
  const worker = async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      signal.throwIfAborted();
      try {
        const { response, bytes } = await fetchPicture(url, signal);
        await cache.put(url, response);
        if (bytes !== null) {
          state.bytes += bytes;
          state.measured++;
        }
      } catch (e) {
        if (signal.aborted) throw e;
        state.failed++;
      }
      state.done++;
      options.progress?.({ ...state });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, urls.length) }, worker));
  signal.throwIfAborted();
  return state;
}
