import { expect, test } from '@playwright/test';

// Public pages, read from the real backend.

test('home carga con la navegación principal', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/home$/);
  const nav = page.getByRole('navigation').first();
  for (const label of ['Cartas', 'Ediciones', 'Mazos', 'Simulador']) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
});

test('cartas: lista, filtro de texto y detalle', async ({ page }) => {
  await page.goto('/cards');
  const thumbs = page.locator('eras-card-thumb');
  await expect(thumbs.first()).toBeVisible();
  const total = await thumbs.count();

  await thumbs.first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('searchbox').first().fill('zzzz-sin-resultados');
  await expect(thumbs).toHaveCount(0);
  await page.getByRole('searchbox').first().fill('');
  await expect(thumbs).toHaveCount(total);
});

test('ediciones lista y abre sobres simulados', async ({ page }) => {
  await page.goto('/editions');
  await expect(page.getByRole('heading', { name: 'Ediciones' })).toBeVisible();
  await page.getByRole('button', { name: /Simular apertura/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abrir sobre', exact: true }).click();
  await expect(page).toHaveURL(/\/booster-result\?.*mode=pack/);
  await expect(page.locator('eras-card-thumb').first()).toBeVisible();
});

test('mazos públicos y vista de un mazo', async ({ page }) => {
  await page.goto('/public-decks');
  const decks = page.locator('eras-deck-card');
  await expect(decks.first()).toBeVisible();
  await decks.first().click();
  await expect(page).toHaveURL(/\/deck\/[^/]+$/);
  await expect(page.locator('eras-card-thumb, eras-card-image').first()).toBeVisible();
});

test('constructor de mazos: agregar copias y avisar al salir', async ({ page }) => {
  await page.goto('/deck-builder');
  const add = page.getByRole('button', { name: /^Añadir (?!una copia)/ }).first();
  await expect(add).toBeVisible();
  const name = ((await add.getAttribute('aria-label')) ?? '').replace(/^Añadir /, '');
  await add.click();
  await add.click();
  await expect(page.getByRole('button', { name: `Quitar una copia de ${name}` })).toBeVisible();

  // Leaving with unsaved changes asks first
  await page.getByRole('navigation').first().getByRole('link', { name: 'Cartas', exact: true }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: /Cancelar|Quedarme|Seguir/ }).click();
  await expect(page).toHaveURL(/\/deck-builder/);
});

test('rutas con sesión redirigen al login', async ({ page }) => {
  for (const path of ['/my-decks', '/simulator', '/admin', '/profile']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test('el backend acepta escrituras desde este origen (CORS)', async ({ page, baseURL }) => {
  // Known gap: the staging backend only allows https://staging.erastcg.com, so writes from next (and from
  // ng serve, whose proxy keeps the browser's Origin) get 403. Remove this line once the origin is allowed.
  test.fail(!baseURL?.includes('staging.erastcg.com'), 'CORS_ALLOWED_ORIGINS de staging no incluye este origen');
  await page.goto('/login');
  // Empty login: the backend must answer as an API (400/401), not reject the origin
  const result = await page.evaluate(async () => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return { status: r.status, body: (await r.text()).slice(0, 60) };
  });
  expect(result.body).not.toContain('Invalid CORS request');
});

test('los enlaces antiguos con mayúsculas redirigen conservando la query', async ({ page }) => {
  await page.goto('/Cards?edition=e2e');
  await expect(page).toHaveURL(/\/cards\?edition=e2e$/);
  await page.goto('/DeckBuilder');
  await expect(page).toHaveURL(/\/deck-builder/);
});

test('ruta desconocida muestra la página 404', async ({ page }) => {
  await page.goto('/no-existe-e2e');
  await expect(page.getByText(/no existe|no encontrada|404/i).first()).toBeVisible();
});
