import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../http/api-error';
import { ApiConfig } from '../http/api-config';
import { AuthService } from '../auth/auth.service';

interface WalletResponse {
  gems: number;
  reward?: number;
  /** The structure decks already bought (each only once). */
  structures?: string[];
}

/** A pack as the server drew it on a purchase: its type, the type it was if it went up a rarity, its cards. */
export interface PurchasedPack {
  packType: string;
  upgradedFrom: string | null;
  /** alt: the copy came out with the card's alternative art. */
  cards: { id: string; finish: 'plain' | 'foil' | 'prism'; alt?: boolean }[];
}

interface PurchaseResponse {
  gems: number;
  packs: PurchasedPack[];
}

/**
 * The signed-in account's simulated gems, kept by the server (DriveManager /api/drive/wallet): the same balance on
 * every device. Reading it gives the daily reward once a day (`reward` says how much, so the shop can tell); a
 * purchase is charged by the server at its own price, and drawn there too (what came out is already in the player's
 * collection): the opening only shows it.
 */
@Injectable({ providedIn: 'root' })
export class WalletStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly auth = inject(AuthService);

  readonly gems = signal(0);
  /** Gems just given as the daily reward (0 when none). */
  readonly reward = signal(0);
  /** The structure decks this account already bought: each can be bought only once. */
  readonly structures = signal<ReadonlySet<string>>(new Set());
  /** Why the last purchase was refused, in Spanish (null when it went through). */
  readonly error = signal<string | null>(null);

  /** What was just paid for and not opened yet, and what came out (see `purchase` and `takeTicket`). */
  private ticket: { name: string; packs: PurchasedPack[] } | null = null;

  constructor() {
    // Loaded for whoever signs in; cleared on sign-out
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      untracked(() => {
        this.gems.set(0);
        this.reward.set(0);
        this.structures.set(new Set());
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
      this.structures.set(new Set(me.structures ?? []));
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
      const done = await firstValueFrom(this.http.post<PurchaseResponse>(this.api.url('/api/drive/wallet/me/purchase'), { editionId, product }));
      this.gems.set(done.gems);
      if (product === 'structure') this.structures.update((owned) => new Set(owned).add(editionId));
      this.ticket = { name: ticket, packs: done.packs ?? [] };
      return true;
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo hacer la compra'));
      void this.refresh();
      return false;
    }
  }

  /** Sets the signed-in account's gems (administrators, to test: manage_users); false when refused. */
  async setGems(gems: number): Promise<boolean> {
    const id = this.auth.user()?.id;
    if (!id) return false;
    try {
      const done = await firstValueFrom(
        this.http.post<WalletResponse>(this.api.url(`/api/drive/wallet/${encodeURIComponent(id)}/grant`), { gems: gems - this.gems() }),
      );
      this.gems.set(done.gems);
      return true;
    } catch {
      return false;
    }
  }

  /** A structure deck given as a reward (already in the collection): owned now, and its opening ready under `ticket`. */
  receiveStructure(editionId: string, packs: PurchasedPack[], ticket: string): void {
    this.structures.update((owned) => new Set(owned).add(editionId));
    this.ticket = { name: ticket, packs };
  }

  /** What came out of `ticket` if it was just paid for, once (it is used up); null otherwise. */
  takeTicket(ticket: string): PurchasedPack[] | null {
    if (this.ticket?.name !== ticket) return null;
    const packs = this.ticket.packs;
    this.ticket = null;
    return packs;
  }
}
