import { Injectable, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { ShopOddsApi } from './shop-odds.api';
import { ShopOdds } from './shop-odds.model';
import { SharedLoad } from '../shared/shared-load';

/** The shop's odds (ShopOdds), read once and kept; a save replaces them for everyone. */
@Injectable({ providedIn: 'root' })
export class ShopOddsStore {
  private readonly api = inject(ShopOddsApi);

  readonly odds = signal<ShopOdds | null>(null);
  readonly error = signal<string | null>(null);
  private readonly loader = new SharedLoad(() => this.fetch(), () => !!this.odds());

  /** Reads them unless they are already here (`force`: again). */
  load(force = false): Promise<void> {
    return this.loader.run(force);
  }

  private async fetch(): Promise<void> {
    try {
      this.odds.set(await firstValueFrom(this.api.get()));
      this.error.set(null);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudieron cargar las probabilidades'));
    }
  }

  /** Saves new odds; throws the server's reason when it refuses them. */
  async save(odds: ShopOdds): Promise<void> {
    this.odds.set(await firstValueFrom(this.api.save(odds)));
  }
}
