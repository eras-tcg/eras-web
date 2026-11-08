import { Browser, BrowserContext, Page, expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { E2E_USER, signIn } from '../fixtures';
import { AWS_ROOT, CORS_IMAGES_PORT, PWA_PORT, PwaServers, startPwaServers } from './pwa-server';

/**
 * The installed app is local-first, landscape and full screen, against the AWS build (a backend that sleeps and is
 * woken by /wake), served as CloudFront serves it (pwa-server.ts counts every request that reaches the backend):
 * - opening it asks the backend nothing (no /api, no /wake) until the player taps something that needs it or
 *   "Conectar"; then the warm-up shows, the backend is woken and the screen opens;
 * - Modo solo sin conexión plays without the backend;
 * - no "Pantalla completa" button, "Gira el teléfono" held upright, and a layout that does not jump when the window is
 *   shorter for a moment (the system bars).
 * The browser's tab keeps the site as it was (the warm-up on opening, the full screen button).
 *
 * Run: `npm run e2e:pwa` (builds production and aws). Screenshots: E2E_SHOTS (test-results/pwa by default).
 */
const BASE = `http://localhost:${PWA_PORT}`;
const SHOTS = process.env['E2E_SHOTS'] ?? join(__dirname, '../../test-results/pwa');
/** A phone held sideways. */
const PHONE = { width: 844, height: 390 };

test.setTimeout(240_000);

let servers: PwaServers | null = null;
test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
});
test.beforeEach(async () => {
  servers = await startPwaServers({ root: AWS_ROOT, wakeAfterMs: 4000 });
});
test.afterEach(async () => {
  await servers?.close();
  servers = null;
});

/** The installed app's window: `(display-mode: standalone)` matches (as pwa-offline.spec.ts does it). */
async function installed(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes('display-mode: standalone') ? ({ ...original(query), matches: true, media: query } as MediaQueryList) : original(query);
  });
}

async function phone(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-CL' });
  return { context, page: await context.newPage() };
}

/**
 * What an earlier visit with the connection left on the device (IndexedDB "eras"/kv): the editions (the hub's artwork)
 * and the player's decks. Written from a file of the site (no page of the app is opened, nothing reaches the backend).
 */
async function keptFromAnEarlierVisit(page: Page): Promise<void> {
  await page.goto(`${BASE}/engine/starter-decks.json`);
  await page.evaluate(
    ([userId, username, artwork]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('eras', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('kv');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('kv', 'readwrite');
          const kv = tx.objectStore('kv');
          kv.put([{ editionId: 'E1', editionName: 'Primera Era', editionImage: artwork }], 'editions');
          kv.put(
            { userId, savedAt: Date.now(), decks: [{ id: 'e2e-own-deck', deckName: 'Mazo e2e', userId, username, privateDeck: true, cards: [] }], images: [], meta: [] },
            `offline-library:${userId}`,
          );
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [E2E_USER.id, E2E_USER.username, `http://localhost:${CORS_IMAGES_PORT}/cards/edition-e1.png?v=1`] as const,
  );
}

async function box(page: Page, selector: string): Promise<{ width: number; height: number }> {
  const rect = await page.locator(selector).first().boundingBox();
  if (!rect) throw new Error(`${selector} is not shown`);
  return { width: Math.round(rect.width), height: Math.round(rect.height) };
}

/** The window is shorter for a moment (Android's bars over a full screen app) and back: the layout box stays. */
async function expectSteadyLayout(page: Page, selector: string): Promise<void> {
  const before = await box(page, selector);
  expect(before.height).toBe(PHONE.height);
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height - 48 });
  await page.waitForTimeout(300);
  expect(await box(page, selector)).toEqual(before);
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(300);
  expect(await box(page, selector)).toEqual(before);
}

async function answerChoices(page: Page): Promise<void> {
  const dialog = page.locator('[role=dialog]');
  if (await dialog.count()) await dialog.first().locator('button:not([disabled])').last().click({ timeout: 2000 }).catch(() => undefined);
}

test('la app instalada abre sin despertar al servidor, juega sin conexión y conecta al pedir algo del servidor', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page);
  await installed(page);
  await keptFromAnEarlierVisit(page);

  // 1. Opened: the hub, nothing asked to the backend (not even after the background prefetch's delay)
  await page.goto(`${BASE}/`);
  await expect(page).toHaveURL(/\/home$/);
  const connect = page.getByRole('button', { name: /Conectar con el servidor/ });
  await expect(connect).toBeVisible();
  await expect(connect).toContainText('Sin conectar');
  // What needs the server says so
  await expect(page.getByRole('link', { name: /Tienda.*necesita conexión/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Mazos/ }).first()).not.toContainText('necesita conexión');
  // Installed: no full screen button
  await expect(page.getByRole('switch', { name: /Pantalla completa/ })).toHaveCount(0);
  await page.waitForTimeout(3000);
  expect(servers!.backendHits).toEqual([]);
  await page.screenshot({ path: join(SHOTS, 'local-first-hub-sin-conectar.png') });

  // The player's decks kept on the device can be browsed before connecting
  await page.getByRole('link', { name: 'Mazos' }).first().click();
  await expect(page).toHaveURL(/\/my-decks$/);
  await expect(page.getByText('Mazo e2e').first()).toBeVisible();
  // After the screen transition
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SHOTS, 'local-first-mazos-del-dispositivo.png') });
  await page.goBack();
  await expect(page).toHaveURL(/\/home$/);
  expect(servers!.backendHits).toEqual([]);

  // 2. The layout does not jump when the window is shorter for a moment (full screen asked on the first tap meanwhile)
  await page.locator('eras-hub-screen').click({ position: { x: 600, y: 200 } });
  await page.waitForTimeout(1000);
  await expectSteadyLayout(page, 'eras-hub-screen');

  // 3. Held upright: "Gira el teléfono" over the whole app
  await page.setViewportSize({ width: PHONE.height, height: PHONE.width });
  await expect(page.getByText('Gira el teléfono')).toBeVisible();
  await page.screenshot({ path: join(SHOTS, 'local-first-gira-el-telefono.png') });
  await page.setViewportSize(PHONE);
  await expect(page.getByText('Gira el teléfono')).toBeHidden();

  // 4. Jugar and a game against the bot: still nothing asked
  await page.getByRole('link', { name: 'Jugar' }).first().click();
  await expect(page).toHaveURL(/\/play$/);
  const menu = page.getByRole('navigation', { name: 'Modos de juego' });
  await expect(menu.getByRole('link', { name: /Online.*necesita conexión/ })).toBeVisible();
  await menu.getByRole('button', { name: 'Modo solo sin conexión' }).click();
  await expect(page).toHaveURL(/\/simulator\/local\/board$/, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Fácil' }).click();
  await page.getByRole('button', { name: 'Ver ST1', exact: true }).click();
  await page.getByRole('button', { name: 'Comenzar partida' }).click();
  await page.getByRole('button', { name: 'Quedarme con todas' }).click({ timeout: 30_000 });
  const turn = page.locator('.strip .turn');
  await expect(turn).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);
  await expectSteadyLayout(page, 'eras-board-page');
  let botPlayed = false;
  let back = false;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline && !back) {
    await answerChoices(page);
    const now = (await turn.textContent())?.trim();
    if (now === 'Turno oponente') botPlayed = true;
    else if (now === 'Turno aliado' && botPlayed) back = true;
    else if (now === 'Turno aliado') await page.getByRole('button', { name: /^Final/ }).click({ timeout: 1000 }).catch(() => undefined);
    await page.waitForTimeout(500);
  }
  expect(botPlayed).toBe(true);
  expect(back).toBe(true);
  await page.screenshot({ path: join(SHOTS, 'local-first-partida-sin-conexion.png') });
  expect(servers!.backendHits).toEqual([]);

  // 5. Something that needs the server (the shop): the warm-up, the backend woken, then the shop
  await page.goto(`${BASE}/home`);
  await expect(connect).toContainText('Sin conectar');
  expect(servers!.backendHits).toEqual([]);
  await page.getByRole('link', { name: /Tienda.*necesita conexión/ }).first().click();
  await expect(page.getByText('Encendiendo el servidor…')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Seguir sin conexión' })).toBeVisible();
  await page.screenshot({ path: join(SHOTS, 'local-first-conectando.png') });
  await expect(page).toHaveURL(/\/editions$/, { timeout: 30_000 });
  await expect(page.getByText('Encendiendo el servidor…')).toBeHidden();
  const hits = [...servers!.backendHits];
  expect(hits[0]).toBe('GET /api/drive/health');
  expect(hits).toContain('POST /wake');
  // Connected: the data loads, the offline library is synced again
  await expect.poll(() => servers!.backendHits.filter((h) => h.startsWith('GET /api/drive/decklists')).length, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.goto(`${BASE}/home`);
  await expect(page.getByRole('button', { name: /Conexión con el servidor: Conectado/ })).toBeVisible();
  await page.screenshot({ path: join(SHOTS, 'local-first-hub-conectado.png') });
  console.log(`backend requests before connecting: 0; on connecting: ${hits.length} (${hits.join(', ')}); in all: ${servers!.backendHits.length}`);
  await context.close();
});

/** The offline games kept on the device for the player (IndexedDB "eras"/kv, `offline-games:<userId>`). */
async function pendingGames(page: Page): Promise<number> {
  return page.evaluate(
    (key) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('eras');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('kv')) return resolve(0);
          const get = db.transaction('kv', 'readonly').objectStore('kv').get(key);
          get.onsuccess = () => {
            db.close();
            resolve((get.result as { games?: unknown[] } | undefined)?.games?.length ?? 0);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    `offline-games:${E2E_USER.id}`,
  );
}

test('una partida sin conexión se guarda en el dispositivo y se envía al conectar para que cuente', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page);
  await installed(page);
  await keptFromAnEarlierVisit(page);
  await page.goto(`${BASE}/home`);
  const connect = page.getByRole('button', { name: /Conectar con el servidor/ });
  await expect(connect).toContainText('Sin conectar');

  // A game against the bot without the server, to its end (the player surrenders)
  await page.getByRole('link', { name: 'Jugar' }).first().click();
  await page.getByRole('navigation', { name: 'Modos de juego' }).getByRole('button', { name: 'Modo solo sin conexión' }).click();
  await expect(page).toHaveURL(/\/simulator\/local\/board$/, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Fácil' }).click();
  await page.getByRole('button', { name: 'Ver ST1', exact: true }).click();
  await page.getByRole('button', { name: 'Comenzar partida' }).click();
  await page.getByRole('button', { name: 'Quedarme con todas' }).click({ timeout: 30_000 });
  await expect(page.locator('.strip .turn')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Menú de partida' }).click();
  await page.getByRole('menuitem', { name: 'Rendirse' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Rendirse' }).click();
  await expect(page.getByText('Te rendiste')).toBeVisible({ timeout: 30_000 });
  // Kept on the device; nothing sent
  await expect.poll(() => pendingGames(page), { timeout: 10_000 }).toBe(1);
  expect(servers!.backendHits).toEqual([]);

  // Connecting sends it to be counted, and the device forgets it once the server answered
  await page.goto(`${BASE}/home`);
  await connect.click();
  await expect(page.getByRole('button', { name: /Conexión con el servidor: Conectado/ })).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => servers!.offlineUploads.length, { timeout: 20_000 }).toBe(1);
  const [sent] = servers!.offlineUploads[0].games;
  expect(servers!.offlineUploads[0].games).toHaveLength(1);
  expect(sent.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(sent.seed).toMatch(/^\d+$/);
  const types = sent.actions.map((a) => (JSON.parse(a.body) as { type: string }).type);
  expect(types[0]).toBe('JOIN_ROOM');
  expect(types).toContain('SET_DECK');
  expect(types[types.length - 1]).toBe('SURRENDER');
  expect(sent.actions.some((a) => a.botMoves > 0)).toBe(true);
  expect(sent.result).toMatchObject({ gameNumber: 1, winnerId: 'bot', endReason: 'surrender' });
  expect(sent.result['digest']).toMatch(/^[0-9a-f]{16}$/);
  await expect(page.getByText('1 partida sin conexión registrada')).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => pendingGames(page), { timeout: 10_000 }).toBe(0);
  await page.screenshot({ path: join(SHOTS, 'local-first-partida-registrada.png') });
  await context.close();
});

test('"Conectar" en la app instalada: el estado Conectando… y luego Conectado', async ({ browser }) => {
  // The health check takes a moment (a slow network): "Conectando…" shows on the hub meanwhile
  await servers?.close();
  servers = await startPwaServers({ root: AWS_ROOT, wakeAfterMs: 4000, healthDelayMs: 2500 });
  const { context, page } = await phone(browser);
  await signIn(page);
  await installed(page);
  await keptFromAnEarlierVisit(page);
  await page.goto(`${BASE}/home`);
  const connect = page.getByRole('button', { name: /Conectar con el servidor/ });
  await expect(connect).toBeVisible();
  await page.waitForTimeout(2000);
  expect(servers!.backendHits).toEqual([]);
  await connect.click();
  await expect(page.getByRole('button', { name: /Conexión con el servidor: Conectando…/ })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, 'local-first-hub-conectando.png') });
  // Asleep: the warm-up while it wakes up
  await expect(page.getByText('Encendiendo el servidor…')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Conexión con el servidor: Conectado/ })).toBeVisible({ timeout: 30_000 });
  expect(servers!.backendHits).toContain('POST /wake');
  await page.screenshot({ path: join(SHOTS, 'local-first-hub-conectado-tras-conectar.png') });
  // Stays on the hub, now connected
  await expect(page).toHaveURL(/\/home$/);
  // Connected, the installed app keeps the pictures for offline by itself: no "Descargar" button in Jugar
  const hitsBefore = servers!.imageHits.cors + servers!.imageHits.plain;
  await expect
    .poll(async () => page.evaluate(async () => (await (await caches.open('eras-card-images-v1')).keys()).length), { timeout: 60_000 })
    .toBeGreaterThan(0);
  expect(servers!.imageHits.cors + servers!.imageHits.plain).toBeGreaterThan(hitsBefore);
  await page.goto(`${BASE}/play`);
  await expect(page.getByRole('button', { name: 'Modo solo sin conexión' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar para jugar sin conexión' })).toHaveCount(0);
  await context.close();
});

test('en la pestaña del navegador nada cambia: el servidor se despierta al abrir y está el botón de pantalla completa', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page);
  await page.goto(`${BASE}/home`);
  await expect(page.getByText(/Encendiendo el servidor…|Conectando…/).first()).toBeVisible();
  await expect(page.getByRole('switch', { name: /Pantalla completa/ })).toBeVisible({ timeout: 30_000 });
  expect(servers!.backendHits).toContain('POST /wake');
  await expect(page.getByRole('button', { name: /Conectar con el servidor/ })).toHaveCount(0);
  await expect(page.getByText('Gira el teléfono')).toHaveCount(0);
  // The layout follows the window, as always (100dvh)
  const before = await box(page, 'eras-hub-screen');
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height - 48 });
  await expect.poll(() => box(page, 'eras-hub-screen').then((b) => b.height)).toBe(before.height - 48);
  await context.close();
});
