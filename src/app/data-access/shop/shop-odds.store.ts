import { Injectable, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { ShopOddsApi } from './shop-odds.api';
import { ShopOdds } from './shop-odds.model';

/** The shop's odds (ShopOdds), read once and kept; a save replaces them for everyone. */
@Injectable({ providedIn: 'root' })
export class ShopOddsStore {
  private readonly api = inject(ShopOddsApi);

  readonly odds = signal<ShopOdds | null>(null);
  readonly error = signal<string | null>(null);
  private loading: Promise<void> | null = null;

  /** Reads them unless they are already here (`force`: again). */
  load(force = false): Promise<void> {
    if (this.odds() && !force) return Promise.resolve();
    this.loading ??= firstValueFrom(this.api.get())
      .then((odds) => {
        this.odds.set(odds);
        this.error.set(null);
      })
      .catch((e) => this.error.set(apiErrorMessage(e, 'No se pudieron cargar las probabilidades')))
      .finally(() => (this.loading = null));
    return this.loading;
  }

  /** Saves new odds; throws the server's reason when it refuses them. */
  async save(odds: ShopOdds): Promise<void> {
    this.odds.set(await firstValueFrom(this.api.save(odds)));
  }
}
