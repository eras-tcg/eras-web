import { Injectable, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { Deck } from './deck.model';
import { DecksApi } from './decks.api';

/** Public decks, cached after the first load. */
@Injectable({ providedIn: 'root' })
export class DecksStore {
  private readonly api = inject(DecksApi);
  private loaded = false;

  readonly publicDecks = signal<Deck[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadPublic(force = false): Promise<void> {
    if (this.loaded && !force) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      this.publicDecks.set(await firstValueFrom(this.api.listPublic()));
      this.loaded = true;
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudieron cargar los mazos públicos'));
    } finally {
      this.loading.set(false);
    }
  }
}
