import { Browser, Page, expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Real two-player game over STOMP, with two isolated browser contexts and two real staging accounts.
 * Needs e2e/.auth.local.json (git-ignored): { baseURL, accounts: [{ username, password }, { ... }] }.
 *   E2E_BASE_URL=https://staging.erastcg.com npx playwright test simulator-2p
 */
interface Account {
  username: string;
  password: string;
}
const authFile = join(__dirname, '.auth.local.json');
const auth: { baseURL?: string; accounts?: Account[] } = existsSync(authFile) ? JSON.parse(readFileSync(authFile, 'utf8')) : {};
const accounts = auth.accounts ?? [];

// The test accounts only exist on the site they were created on (staging)
test.skip(
  accounts.length < 2 || !process.env['E2E_BASE_URL'] || process.env['E2E_BASE_URL'] !== auth.baseURL,
  'Requiere e2e/.auth.local.json con cuentas del mismo sitio que E2E_BASE_URL',
);
test.setTimeout(150_000);

async function player(browser: Browser, account: Account): Promise<Page> {
  const context = await browser.newContext({ baseURL: process.env['E2E_BASE_URL'], locale: 'es-CL' });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(account.username);
  await page.getByLabel('Contraseña').fill(account.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

/** Picks a starter deck (they all have an "Iniciador" creature): that creates/joins the room and opens the board. */
async function enterWithDeck(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ver ST2', exact: true }).click();
  await expect(page).toHaveURL(/\/board$/);
}

const turnLabel = (page: Page) => page.locator('.topbar').getByText(/Tu turno|Turno del rival/);

test('partida real de 2 jugadores', async ({ browser }) => {
  const host = await player(browser, accounts[0]);
  const guest = await player(browser, accounts[1]);

  // Host creates the room and enters; the guest opens the shared link
  await host.goto('/simulator');
  await enterWithDeck(host);
  const roomUrl = new URL(host.url()).pathname.replace(/\/board$/, '');
  await expect(host.getByText('Esperando al rival')).toBeVisible();

  await guest.goto(roomUrl);
  await enterWithDeck(guest);

  // Host decides who starts
  await host.getByRole('button', { name: `Empieza ${accounts[0].username}` }).click();

  for (const page of [host, guest]) {
    await expect(page.getByText('Elige tu criatura iniciadora')).toBeVisible();
    await page.getByRole('button', { name: /^Elegir / }).first().click();
  }
  for (const page of [host, guest]) {
    await page.getByRole('button', { name: 'Quedarme con todas' }).click();
  }

  // Game in progress, seen consistently by both
  await expect(turnLabel(host)).toHaveText(/Tu turno/);
  await expect(turnLabel(guest)).toHaveText(/Turno del rival/);

  // A draw on the host's side shows up in the guest's view of the opponent's hand
  const opponentHand = guest.locator('eras-player-half[opponent] eras-game-zone.hand');
  const before = await opponentHand.locator('eras-sim-card').count();
  await host.getByRole('button', { name: 'Robar', exact: true }).click();
  await expect(opponentHand.locator('eras-sim-card')).toHaveCount(before + 1);

  // Passing the turn flips it on both screens
  await host.getByRole('button', { name: 'Final' }).click();
  await expect(turnLabel(host)).toHaveText(/Turno del rival/);
  await expect(turnLabel(guest)).toHaveText(/Tu turno/);

  // Surrender ends the game for both
  await host.getByRole('button', { name: 'Opciones' }).click();
  await host.getByRole('menuitem', { name: 'Rendirse' }).click();
  await host.getByRole('dialog').getByRole('button', { name: 'Rendirse' }).click();
  for (const page of [host, guest]) await expect(page.getByText('Partida terminada')).toBeVisible();
});
