import { Page, expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { E2E_USER, signIn } from '../fixtures';
import { PLAIN_IMAGES_PORT, PWA_PORT, PwaServers, startPwaServers } from './pwa-server';

/**
 * The installed app without the connection, against the production build (service worker on): it is loaded once
 * online (the service worker installs and keeps the app, the player's decks are kept in IndexedDB, the card pictures
 * are downloaded from "Descargar para jugar sin conexión"), then the servers stop and the browser goes offline, and
 * the app is opened again: it opens on "Jugar" and a game against the bot is played with the player's own deck.
 *
 * Run: `npm run e2e:pwa` (builds, then playwright.pwa.config.ts).
 */
const BASE = `http://localhost:${PWA_PORT}`;
const SHOTS = process.env['E2E_SHOTS'] ?? join(__dirname, '../../test-results/pwa');

test.setTimeout(300_000);
test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, serviceWorkers: 'allow' });

let servers: PwaServers | null = null;
test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  servers = await startPwaServers();
});
test.afterAll(async () => servers?.close());

async function answerChoices(page: Page): Promise<void> {
  const dialog = page.locator('[role=dialog]');
  if (await dialog.count()) await dialog.first().locator('button:not([disabled])').last().click({ timeout: 2000 }).catch(() => undefined);
}

/** The record OfflineLibrarySync keeps for the player (IndexedDB "eras"), or null. */
function storedDecks(page: Page): Promise<string[] | null> {
  return page.evaluate(
    (key) =>
      new Promise<string[] | null>((resolve) => {
        const open = indexedDB.open('eras');
        // Not made yet: not made here either (the app makes it)
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.close();
            return resolve(null);
          }
          const get = db.transaction('kv').objectStore('kv').get(key);
          get.onsuccess = () => {
            resolve((get.result as { decks: { deckName: string }[] } | undefined)?.decks.map((d) => d.deckName) ?? null);
            db.close();
          };
          get.onerror = () => resolve(null);
        };
      }),
    `offline-library:${E2E_USER.id}`,
  );
}

/**
 * Pretends to be the installed app's window: `(display-mode: standalone)` matches. (Chromium's own emulation of it
 * through CDP neither works headless nor keeps the offline emulation.)
 */
async function standalone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes('display-mode: standalone') ? ({ ...original(query), matches: true, media: query } as MediaQueryList) : original(query);
  });
}

test('la app instalada abre y juega contra el bot sin conexión, con el mazo propio guardado', async ({ page, context }) => {
  await signIn(page);

  // 1. Online, once: the service worker installs, the decks are kept, the pictures are downloaded
  await page.goto(`${BASE}/play`);
  await expect(page.getByRole('button', { name: 'Modo solo sin conexión' })).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 90_000 });
  await expect.poll(() => storedDecks(page), { timeout: 30_000 }).toEqual(['Mazo e2e']);

  await page.getByRole('button', { name: 'Descargar para jugar sin conexión' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByText('Lista: se abre sin conexión.')).toBeVisible({ timeout: 120_000 });
  await expect(panel.getByText(/y tu mazo guardado/)).toBeVisible();
  await expect(panel.getByText(/0 de \d+ guardadas/)).toBeVisible({ timeout: 30_000 });
  await panel.getByRole('button', { name: 'Descargar' }).click();
  await expect(panel.getByText('Listo: las imágenes quedaron guardadas para jugar sin conexión.')).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByText(/Las imágenes guardadas ocupan unos/)).toBeVisible();
  await expect(panel.getByText(/reserva varios MB por cada imagen de otro sitio/)).toBeVisible();
  await page.screenshot({ path: join(SHOTS, 'offline-download-panel.png') });
  expect(servers!.imageHits.plain).toBeGreaterThan(0);
  await panel.getByRole('button', { name: 'Cerrar', exact: true }).last().click();

  // 2. No servers, no network; the installed app is opened again
  await servers!.close();
  servers = null;
  await context.setOffline(true);
  await standalone(page);
  await page.goto(`${BASE}/`);
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByText(/Sin conexión\. Puedes jugar contra el bot sin conexión/)).toBeVisible();
  // The server's modes are not offered without the connection
  await expect(page.getByRole('link', { name: 'Online' })).toHaveCount(0);
  // Installed: no "Instalar ERAS"
  await expect(page.getByRole('button', { name: 'Instalar ERAS' })).toHaveCount(0);
  await page.screenshot({ path: join(SHOTS, 'offline-launch-desktop.png') });

  // 3. A game against the bot with the deck kept on the device
  await page.getByRole('button', { name: 'Modo solo sin conexión' }).first().click();
  await expect(page).toHaveURL(/\/simulator\/local\/board$/, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Fácil' }).click();
  await page.getByRole('button', { name: 'Ver Mazo e2e', exact: true }).click();
  await page.getByRole('button', { name: 'Comenzar partida' }).click();
  await page.getByRole('button', { name: 'Quedarme con todas' }).click({ timeout: 30_000 });

  const turn = page.locator('.strip .turn');
  await expect(turn).toBeVisible({ timeout: 30_000 });
  // The deck's pictures come from the host without CORS: shown from the service worker's cache
  await expect
    .poll(
      () =>
        page.evaluate(
          (port) =>
            [...document.images].filter((img) => img.src.includes(`localhost:${port}`) && img.complete && img.naturalWidth > 0).length,
          PLAIN_IMAGES_PORT,
        ),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
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
  await page.screenshot({ path: join(SHOTS, 'offline-game-desktop.png') });

  // 4. A phone held upright, still offline, in the browser (not installed): "Instalar ERAS" follows the browser's offer
  const phone = await context.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(`${BASE}/play`);
  await expect(phone.getByRole('button', { name: 'Modo solo sin conexión' }).first()).toBeVisible();
  await expect(phone.getByRole('button', { name: 'Instalar ERAS' })).toHaveCount(0);
  await phone.screenshot({ path: join(SHOTS, 'play-offline-phone.png') });

  // Chromium offers the installation only under conditions a test cannot meet: the same event, made by hand
  await phone.evaluate(() => {
    const offer = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
    const w = window as unknown as { __prompted: number };
    w.__prompted = 0;
    offer['prompt'] = () => {
      w.__prompted++;
      return Promise.resolve();
    };
    offer['userChoice'] = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(offer);
  });
  const install = phone.getByRole('button', { name: 'Instalar ERAS' });
  await expect(install).toBeVisible();
  await phone.screenshot({ path: join(SHOTS, 'install-button-phone.png') });
  await install.click();
  await expect.poll(() => phone.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);
  await expect(install).toHaveCount(0);
});
