import { expect, test } from '@playwright/test';
import { E2E_DECK, E2E_USER, fakeJwt, mockSignedInApi, signIn } from './fixtures';

// Flows that need a session. The session and the private endpoints are mocked in the browser.

test('login guarda la sesión y salir la borra', async ({ page }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({ json: { token: fakeJwt(E2E_USER.id) } }));
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(E2E_USER.username);
  await page.getByLabel('Contraseña').fill('e2e-no-real');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Menú de la cuenta' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeTruthy();

  await page.getByRole('button', { name: 'Menú de la cuenta' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
});

test('login fallido muestra el error', async ({ page }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({ status: 401, json: { message: 'Bad credentials' } }));
  await page.goto('/login');
  await page.getByLabel('Usuario').fill('e2e');
  await page.getByLabel('Contraseña').fill('e2e-no-real');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('mis mazos lista los mazos propios', async ({ page }) => {
  await signIn(page);
  await mockSignedInApi(page);
  await page.goto('/my-decks');
  await expect(page.getByText(E2E_DECK.deckName)).toBeVisible();
});

test('simulador: elegir un mazo crea la sala', async ({ page }) => {
  await signIn(page);
  await mockSignedInApi(page);
  const created = page.waitForRequest((r) => r.url().endsWith('/api/simulator/rooms') && r.method() === 'POST');
  await page.goto('/simulator');
  await expect(page.getByRole('heading', { name: 'Tus mazos' })).toBeVisible();
  await page.getByRole('button', { name: `Ver ${E2E_DECK.deckName}` }).click();
  await created;
});

test('sin permisos, las herramientas de administración redirigen', async ({ page }) => {
  await signIn(page);
  await page.goto('/users-manager');
  await expect(page).not.toHaveURL(/\/users-manager/);
});
