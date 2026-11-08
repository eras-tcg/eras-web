import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { IncomingMessage, Server, ServerResponse, createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { E2E_USER } from '../fixtures';

/**
 * The production build served as nginx/CloudFront serve it (SPA fallback, the service worker's files revalidated,
 * hashed bundles immutable), with a mocked API and two image hosts on other origins: one that answers CORS and one
 * that does not, as the card pictures' host may or may not. Nothing reaches a real backend.
 */
export const PWA_PORT = 4310;
export const CORS_IMAGES_PORT = 4311;
export const PLAIN_IMAGES_PORT = 4312;

const root = join(__dirname, '../../dist/eras-web/browser');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};

interface Meta {
  id: string;
  cardName?: string | null;
  edition?: string | null;
  starter?: boolean | null;
}

/** The card catalog: a drive card for each starter deck card (CORS host) and, for the player's deck, a copy of ST2's on the plain host. */
function catalog() {
  const starters = JSON.parse(readFileSync(join(root, 'engine/starter-decks.json'), 'utf8')) as { decks: Record<string, { metadata: Meta[] }> };
  const metas = new Map<string, Meta>();
  for (const deck of Object.values(starters.decks)) for (const m of deck.metadata) metas.set(m.id, m);
  const drive = (prefix: string, port: number, m: Meta) => ({
    id: `${prefix}-${m.id}`,
    name: m.cardName ?? null,
    edition: m.edition ?? '',
    sub_edition: '',
    number: 1,
    color_identity: 'B',
    image_url: `http://localhost:${port}/cards/${prefix}-${m.id}.png?v=1`,
    time_stamp: '',
  });
  const images = [...metas.values()].map((m) => drive('drv', CORS_IMAGES_PORT, m));
  const st2 = Object.entries(starters.decks).find(([id]) => id.toLowerCase().includes('st2'))?.[1] ?? Object.values(starters.decks)[0];
  const own = st2.metadata.map((m) => drive('own', PLAIN_IMAGES_PORT, m));
  const deck = {
    id: 'e2e-own-deck',
    deckName: 'Mazo e2e',
    userId: E2E_USER.id,
    username: E2E_USER.username,
    privateDeck: true,
    deckImage: null,
    cards: st2.metadata.flatMap((m) => Array<string>(m.starter ? 1 : 3).fill(`own-${m.id}`)),
  };
  return { images: [...images, ...own], meta: [...metas.values()], deck };
}

function json(res: ServerResponse, body: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

export interface PwaServers {
  /** Requests each image host received. */
  imageHits: { cors: number; plain: number };
  close(): Promise<void>;
}

export async function startPwaServers(): Promise<PwaServers> {
  if (!existsSync(join(root, 'ngsw.json'))) throw new Error('Build the app first: npx ng build (production, with the service worker)');
  const data = catalog();
  const hits = { cors: 0, plain: 0 };

  const api = (req: IncomingMessage, res: ServerResponse, url: URL) => {
    if (url.pathname === '/api/drive/decklists') return json(res, url.searchParams.get('userId') === E2E_USER.id ? [data.deck] : []);
    if (url.pathname === '/api/drive/cards/db') return json(res, data.images);
    if (url.pathname === '/api/cards/search') return json(res, data.meta);
    if (url.pathname === '/api/cards/ref' || url.pathname === '/api/simulator/unprogrammed') return json(res, {});
    return json(res, { message: 'not mocked' }, 404);
  };

  const site = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PWA_PORT}`);
    if (url.pathname.startsWith('/api/')) return api(req, res, url);
    let file = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root)) return json(res, {}, 403);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      if (extname(url.pathname)) return json(res, {}, 404);
      file = join(root, 'index.html');
    }
    const hashed = /-[A-Za-z0-9_-]{8}\.(js|css)$/.test(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(file).pipe(res);
  });

  const picture = readFileSync(join(root, 'images/card-back.png'));
  const imageHost = (cors: boolean) =>
    createServer((req, res) => {
      if (cors) hits.cors++;
      else hits.plain++;
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400', ...(cors ? { 'Access-Control-Allow-Origin': '*' } : {}) });
      res.end(picture);
    });

  const servers: Server[] = [site, imageHost(true), imageHost(false)];
  const ports = [PWA_PORT, CORS_IMAGES_PORT, PLAIN_IMAGES_PORT];
  await Promise.all(servers.map((s, i) => new Promise<void>((resolve) => s.listen(ports[i], 'localhost', resolve))));
  return {
    imageHits: hits,
    close: () =>
      Promise.all(
        servers.map(
          (s) =>
            new Promise<void>((resolve) => {
              s.closeAllConnections();
              s.close(() => resolve());
            }),
        ),
      ).then(() => undefined),
  };
}
