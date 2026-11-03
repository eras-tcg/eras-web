import { describe, expect, it } from 'vitest';
import { hasOwnLoading, waitedFor } from './loading';

describe('loading screen', () => {
  it('waits for every request to the API, reads and changes, but the background ones', () => {
    expect(waitedFor('/api/drive/editions', false)).toBe(true);
    expect(waitedFor('https://erastcg.com/api/cards', false)).toBe(true);
    expect(waitedFor('/api/drive/wallet/me/purchase', false)).toBe(true);
    expect(waitedFor('/api/drive/progression/me/visit', true)).toBe(false);
    expect(waitedFor('/assets/news.json', false)).toBe(false);
  });

  it('is never on the simulator, which has its own', () => {
    expect(hasOwnLoading('/simulator')).toBe(true);
    expect(hasOwnLoading('/simulator/abc/board')).toBe(true);
    expect(hasOwnLoading('/simulator?room=1')).toBe(true);
    expect(hasOwnLoading('/simulators-guide')).toBe(false);
    expect(hasOwnLoading('/home')).toBe(false);
  });
});
