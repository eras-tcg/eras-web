import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../http/api-error';
import { ApiConfig } from '../http/api-config';
import { AuthService } from '../auth/auth.service';

interface WalletResponse {
  gems: number;
  reward?: number;
}

/**
 * The signed-in account's simulated gems, kept by the server (DriveManager /api/drive/wallet): the same balance on
 * every device. Reading it gives the daily reward once a day (`reward` says how much, so the shop can tell); a
 * purchase is charged by the server at its own price.
 */
@Injectable({ providedIn: 'root' })
export class WalletStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly auth = inject(AuthService);

  readonly gems = signal(0);
  /** Gems just given as the daily reward (0 when none). */
  readonly reward = signal(0);
  /** Why the last purchase was refused, in Spanish (null when it went through). */
  readonly error = signal<string | null>(null);

  /** What was just paid for and not opened yet (see `purchase` and `takeTicket`). */
  private ticket: string | null = null;

  constructor() {
    // Loaded for whoever signs in; cleared on sign-out
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      untracked(() => {
        this.gems.set(0);
        this.reward.set(0);
        if (id) void this.refresh();
      });
    });
  }

  /** Reads the balance again (a shop left open past midnight gets the new reward). */
  async refresh(): Promise<void> {
    try {
      const me = await firstValueFrom(this.http.get<WalletResponse>(this.api.url('/api/drive/wallet/me')));
      this.gems.set(me.gems);
      if (me.reward) this.reward.set(me.reward);
    } catch {
      // An older server without wallets: no gems
    }
  }

  /**
   * Buys a "pack", a "box" or a "structure" deck; false (and nothing paid) when the server refuses (`error` says why).
   * `ticket` names what was bought, so the opening can check it was paid: reloading it, or reaching its URL
   * directly, does not open it for free.
   */
  async purchase(editionId: string, product: 'pack' | 'box' | 'structure', ticket: string): Promise<boolean> {
    this.error.set(null);
    try {
      const done = await firstValueFrom(this.http.post<WalletResponse>(this.api.url('/api/drive/wallet/me/purchase'), { editionId, product }));
      this.gems.set(done.gems);
      this.ticket = ticket;
      return true;
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo hacer la compra'));
      void this.refresh();
      return false;
    }
  }

  /** True once if `ticket` was just paid for (it is used up). */
  takeTicket(ticket: string): boolean {
    const paid = this.ticket === ticket;
    if (paid) this.ticket = null;
    return paid;
  }
}
