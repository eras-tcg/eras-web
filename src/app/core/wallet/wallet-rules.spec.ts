import { describe, expect, it } from 'vitest';
import { DAILY_GEMS, STARTING_GEMS, dayOf, openWallet, spend } from './wallet-rules';

describe('dayOf', () => {
  it('uses the local calendar day', () => {
    expect(dayOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('openWallet', () => {
  it('starts a new wallet with the starting gems and no extra reward', () => {
    expect(openWallet(null, '2026-11-02')).toEqual({ wallet: { gems: STARTING_GEMS, lastReward: '2026-11-02' }, reward: 0 });
  });

  it('gives the daily reward once per day', () => {
    const first = openWallet({ gems: 50, lastReward: '2026-11-01' }, '2026-11-02');
    expect(first).toEqual({ wallet: { gems: 50 + DAILY_GEMS, lastReward: '2026-11-02' }, reward: DAILY_GEMS });
    expect(openWallet(first.wallet, '2026-11-02').reward).toBe(0);
  });

  it('repairs a broken saved wallet', () => {
    expect(openWallet({ gems: Number.NaN, lastReward: '' }, '2026-11-02').wallet.gems).toBe(STARTING_GEMS);
    expect(openWallet({ gems: -20, lastReward: '2026-11-01' }, '2026-11-02').wallet.gems).toBe(DAILY_GEMS);
  });
});

describe('spend', () => {
  it('pays when the gems reach, refuses otherwise', () => {
    expect(spend({ gems: 100, lastReward: 'x' }, 100)?.gems).toBe(0);
    expect(spend({ gems: 99, lastReward: 'x' }, 100)).toBeNull();
  });
});

