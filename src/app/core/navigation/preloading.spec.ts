import { describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { MAIN_SCREENS, preloads } from './preloading';

describe('main screens fetched ahead', () => {
  const screens = routes.find((r) => r.path === '' && r.children)?.children ?? [];

  it('names only screens that exist', () => {
    const paths = new Set(screens.map((r) => r.path));
    for (const path of MAIN_SCREENS) expect(paths.has(path), path).toBe(true);
  });

  it('fetches the main screens, not the admin tools nor the login', () => {
    const byPath = (path: string) => screens.find((r) => r.path === path)!;
    expect(preloads(byPath('cards'))).toBe(true);
    expect(preloads(byPath('deck-builder'))).toBe(true);
    expect(preloads(byPath('simulator/:roomId/board'))).toBe(true);
    expect(preloads(byPath('users-manager'))).toBe(false);
    expect(preloads(byPath('login'))).toBe(false);
  });
});
