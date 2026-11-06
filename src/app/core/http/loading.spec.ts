import { describe, expect, it } from 'vitest';
import { hasOwnLoading, waitedFor } from './loading';

describe('loading screen', () => {
  it('waits for the changes sent to the API, not for reads (the page shows its own loading) nor background ones', () => {
    expect(waitedFor('/api/drive/editions', false, 'GET')).toBe(false);
    expect(waitedFor('https://erastcg.com/api/cards', false)).toBe(false);
    expect(waitedFor('/api/drive/wallet/me/purchase', false, 'POST')).toBe(true);
    expect(waitedFor('/api/drive/decks/1', false, 'put')).toBe(true);
    expect(waitedFor('/api/drive/progression/me/visit', true, 'POST')).toBe(false);
    expect(waitedFor('/assets/news.json', false, 'POST')).toBe(false);
  });

  it('is never on the simulator, which has its own', () => {
    expect(hasOwnLoading('/simulator')).toBe(true);
    expect(hasOwnLoading('/simulator/abc/board')).toBe(true);
    expect(hasOwnLoading('/simulator?room=1')).toBe(true);
    expect(hasOwnLoading('/simulators-guide')).toBe(false);
    expect(hasOwnLoading('/home')).toBe(false);
  });
});
