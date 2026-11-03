import { describe, expect, it } from 'vitest';
import { hasOwnLoading, waitedFor } from './loading';

describe('loading screen', () => {
  it('waits only for reads of the API the player asked for', () => {
    expect(waitedFor('GET', '/api/drive/editions', false)).toBe(true);
    expect(waitedFor('get', 'https://erastcg.com/api/cards', false)).toBe(true);
    expect(waitedFor('GET', '/api/drive/editions', true)).toBe(false);
    expect(waitedFor('POST', '/api/drive/wallet/me/purchase', false)).toBe(false);
    expect(waitedFor('GET', '/assets/news.json', false)).toBe(false);
  });

  it('is never on the simulator, which has its own', () => {
    expect(hasOwnLoading('/simulator')).toBe(true);
    expect(hasOwnLoading('/simulator/abc/board')).toBe(true);
    expect(hasOwnLoading('/simulator?room=1')).toBe(true);
    expect(hasOwnLoading('/simulators-guide')).toBe(false);
    expect(hasOwnLoading('/home')).toBe(false);
  });
});
