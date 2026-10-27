import { Page } from '@playwright/test';

/** Unsigned JWT with the claims the app reads (`sub`, `permissions`); the backend never sees it. */
export function fakeJwt(sub: string, permissions: string[] = []): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub, permissions })}.e2e`;
}

export const E2E_USER = { id: 'e2e-user', username: 'e2e' };

/** Starts the page with a stored session (same localStorage keys as the app), without calling the backend. */
export async function signIn(page: Page, permissions: string[] = []): Promise<void> {
  const token = fakeJwt(E2E_USER.id, permissions);
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem('auth_token', t);
      localStorage.setItem('auth_user', u);
    },
    [token, JSON.stringify({ ...E2E_USER, permissions })] as const,
  );
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

/**
 * Mocks the endpoints a signed-in user needs: with a fake token the real backend would answer 403.
 * Public reads (cards, editions, public decks) still go to the backend.
 */
export async function mockSignedInApi(page: Page): Promise<void> {
  await page.route(/\/api\/drive\/decklists(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    // Own decks are requested with ?userId=; public ones are left to the backend
    if (url.searchParams.get('userId') !== E2E_USER.id) return route.fallback();
    return route.fulfill({ json: [E2E_DECK] });
  });
  await page.route(/\/api\/simulator\/rooms(\/.*)?$/, (route) =>
    route.fulfill({ json: { roomId: 'e2e-room', status: 'WAITING', playerIds: [] } }),
  );
}
