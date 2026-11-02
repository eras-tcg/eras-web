/**
 * Simulated gems: there is no money on the platform. Every account starts with a balance on each device and gets
 * a daily reward; the Editions shop spends them (its prices: data-access/shop/shop-rules.ts).
 */
export const STARTING_GEMS = 2400;
export const DAILY_GEMS = 300;

export interface Wallet {
  gems: number;
  /** Day (YYYY-MM-DD, local time) of the last daily reward. */
  lastReward: string;
}

/** Local calendar day of `date`, as YYYY-MM-DD. */
export function dayOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The wallet as of `today`: a new one starts with the starting gems (that day's reward included); an existing
 * one gets the daily reward once per day. `reward` is what was just added (0 when nothing was).
 */
export function openWallet(saved: Wallet | null, today: string): { wallet: Wallet; reward: number } {
  if (!saved || !Number.isFinite(saved.gems)) return { wallet: { gems: STARTING_GEMS, lastReward: today }, reward: 0 };
  if (saved.lastReward === today) return { wallet: saved, reward: 0 };
  return { wallet: { gems: Math.max(0, saved.gems) + DAILY_GEMS, lastReward: today }, reward: DAILY_GEMS };
}

/** The wallet after paying `price`, or null when the gems do not reach. */
export function spend(wallet: Wallet, price: number): Wallet | null {
  return price <= wallet.gems ? { ...wallet, gems: wallet.gems - price } : null;
}
