import { Page, expect, test } from '@playwright/test';
import { signIn } from './fixtures';

/**
 * Modo solo sin conexión: a game against the bot with the engine in a Web Worker. The server is never reached (every
 * /api request fails, as with no connection), and the browser goes offline once the game's room is open: the deck
 * and level are chosen, the game is played through the board and the bot's moves arrive, all without the network.
 */
test.setTimeout(150_000);

/** Answers whatever choice the game asks (its last button: "Sí", "Confirmar"…), so the game goes on. */
async function answerChoices(page: Page): Promise<void> {
  const dialog = page.locator('[role=dialog]');
  if (await dialog.count()) await dialog.first().locator('button:not([disabled])').last().click({ timeout: 2000 }).catch(() => undefined);
}

test('una partida contra el bot sin conexión', async ({ page, context }) => {
  await signIn(page);
  await page.route('**/api/**', (route) => route.abort('internetdisconnected'));
  const workers: string[] = [];
  page.on('worker', (w) => workers.push(w.url()));

  await page.goto('/play');
  await page.getByRole('button', { name: 'Modo solo sin conexión' }).first().click();
  await expect(page).toHaveURL(/\/simulator\/local\/board$/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Modo solo sin conexión' })).toBeVisible();
  // The engine runs in its own worker (its chunk is loaded only now)
  expect(workers.some((url) => /worker-.*\.js|engine/.test(url))).toBe(true);

  await context.setOffline(true);

  // The pre-room as online: the starter decks, the bot's level, friendly only
  await expect(page.getByText('(sin conexión)')).toBeVisible();
  await page.getByRole('button', { name: 'Fácil' }).click();
  await page.getByRole('button', { name: 'Ver ST1', exact: true }).click();
  await page.getByRole('button', { name: 'Comenzar partida' }).click();
  await page.getByRole('button', { name: 'Quedarme con todas' }).click({ timeout: 30_000 });

  // Played through the board: my turn ends with its phase bar; the bot's turn comes and goes
  const turn = page.locator('.strip .turn');
  await expect(turn).toBeVisible({ timeout: 30_000 });
  let botPlayed = false;
  let back = false;
  const deadline = Date.now() + 100_000;
  while (Date.now() < deadline && !back) {
    await answerChoices(page);
    const now = (await turn.textContent())?.trim();
    if (now === 'Turno oponente') botPlayed = true;
    else if (now === 'Turno aliado' && botPlayed) back = true;
    else if (now === 'Turno aliado') await page.getByRole('button', { name: /^Final/ }).click({ timeout: 1000 }).catch(() => undefined);
    await page.waitForTimeout(500);
  }
  // The bot played its turn (its moves arrived from the worker) and gave the turn back
  expect(botPlayed).toBe(true);
  expect(back).toBe(true);
  await expect(page.getByText('Sin conexión, reintentando…')).toHaveCount(0);
});
