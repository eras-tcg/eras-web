import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { Wallet, dayOf, openWallet, spend } from './shop-rules';

const KEY = 'eras-wallet-';

/**
 * The signed-in user's simulated gems for the Editions shop (see shop-rules.ts). Kept on this device only, per
 * account: there is no money on the server. Opening it each day adds the daily reward (`reward` says how much,
 * so the shop can tell).
 */
@Injectable({ providedIn: 'root' })
export class WalletStore {
  private readonly auth = inject(AuthService);
  private readonly wallet = signal<Wallet | null>(null);

  readonly gems = computed(() => this.wallet()?.gems ?? 0);
  /** Gems just given as the daily reward (0 when none). */
  readonly reward = signal(0);

  constructor() {
    // Each account has its own wallet; signing out forgets it
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      untracked(() => (id ? this.open(id) : this.wallet.set(null)));
    });
  }

  /** What was just paid for and not opened yet (see `buy` and `takeTicket`). */
  private ticket: string | null = null;

  /**
   * Pays `price`; false (and nothing paid) when the gems do not reach. `ticket` names what was bought, so the
   * opening can check it was paid: reloading it, or reaching its URL directly, does not open it for free.
   */
  buy(price: number, ticket: string): boolean {
    const current = this.wallet();
    const next = current && spend(current, price);
    if (!next) return false;
    this.save(next);
    this.ticket = ticket;
    return true;
  }

  /** True once if `ticket` was just paid for (it is used up). */
  takeTicket(ticket: string): boolean {
    const paid = this.ticket === ticket;
    if (paid) this.ticket = null;
    return paid;
  }

  /** Re-reads the day, so a shop left open past midnight still gets the new reward. */
  refresh(): void {
    const id = this.auth.user()?.id;
    if (id) this.open(id);
  }

  private open(userId: string): void {
    const { wallet, reward } = openWallet(read(KEY + userId), dayOf(new Date()));
    this.reward.set(reward);
    this.save(wallet);
  }

  private save(wallet: Wallet): void {
    this.wallet.set(wallet);
    const id = this.auth.user()?.id;
    if (id) write(KEY + id, wallet);
  }
}

// Storage can be unavailable (private mode): the wallet then lasts until the page closes
function read(key: string): Wallet | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Wallet) : null;
  } catch {
    return null;
  }
}

function write(key: string, wallet: Wallet): void {
  try {
    localStorage.setItem(key, JSON.stringify(wallet));
  } catch {
    // ignored, see read
  }
}
