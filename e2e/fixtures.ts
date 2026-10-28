import { Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Unsigned JWT with the claims the app reads (`sub`, `permissions`); the backend never sees it. */
export function fakeJwt(sub: string, permissions: string[] = []): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub, permissions })}.e2e`;
}

export const E2E_USER = { id: 'e2e-user', username: 'e2e' };

/** Starts the page with a stored session (same localStorage keys as the app), without calling the backend. */
export async function signIn(page: Page, permissions: string[] = []): Promise<void> {
  await storeSession(page, fakeJwt(E2E_USER.id, permissions), { ...E2E_USER, permissions });
}

async function storeSession(page: Page, token: string, user: { id: string; username: string; permissions: string[] }): Promise<void> {
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem('auth_token', t);
      localStorage.setItem('auth_user', u);
    },
    [token, JSON.stringify(user)] as const,
  );
}

interface Account {
  username: string;
  password: string;
}

/**
 * Test accounts (git-ignored e2e/.auth.local.json) live on the staging backend, which next.erastcg.com,
 * staging.erastcg.com and `ng serve` all use. Production has none.
 */
const authFile = join(__dirname, '.auth.local.json');
const auth: { baseURL?: string; accounts?: Account[] } = existsSync(authFile) ? JSON.parse(readFileSync(authFile, 'utf8')) : {};
const usesStagingBackend = (baseURL: string | undefined) => !!baseURL && !/^https:\/\/(www\.)?erastcg\.com/.test(baseURL);

let realToken: Promise<string | null> | null = null;

/**
 * Real session with the first test account: every data endpoint needs one. Resolves false when there is
 * no test account for the site's backend (e.g. production), so data tests can be skipped.
 */
export async function signInReal(page: Page, baseURL: string | undefined): Promise<boolean> {
  const account = auth.accounts?.[0];
  if (!account || !auth.baseURL || !usesStagingBackend(baseURL)) return false;
  realToken ??= fetch(`${auth.baseURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: account.username, password: account.password }),
  })
    .then(async (r) => (r.ok ? ((await r.json()) as { token?: string }).token ?? null : null))
    .catch(() => null);
  const token = await realToken;
  if (!token) return false;
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { sub?: string; permissions?: string[] };
  await storeSession(page, token, { id: String(payload.sub ?? ''), username: account.username, permissions: payload.permissions ?? [] });
  return true;
}

/** A minimal own deck, returned by the mocked decklist endpoints. */
export const E2E_DECK = {
  id: 'e2e-deck',
  deckName: 'Mazo e2e',
  userId: E2E_USER.id,
  username: E2E_USER.username,
  privateDeck: true,
  cards: [],
};

/** Mocks the endpoints a signed-in user needs: with a fake token the real backend would answer 401/403. */
export async function mockSignedInApi(page: Page): Promise<void> {
  await page.route(/\/api\/drive\/decklists(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    // Own decks are requested with ?userId=; the rest gets an empty list
    if (url.searchParams.get('userId') !== E2E_USER.id) return route.fulfill({ json: [] });
    return route.fulfill({ json: [E2E_DECK] });
  });
  await page.route(/\/api\/simulator\/rooms(\/.*)?$/, (route) =>
    route.fulfill({ json: { roomId: 'e2e-room', status: 'WAITING', playerIds: [] } }),
  );
}
