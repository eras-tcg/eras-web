import { Injectable, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { Deck, DeckSaveRequest } from './deck.model';
import { DecksApi } from './decks.api';

/** Public decks and the signed-in user's decks, cached until a save or delete invalidates them. */
@Injectable({ providedIn: 'root' })
export class DecksStore {
  private readonly api = inject(DecksApi);
  private publicLoaded = false;
  private mineOwner: string | null = null;

  readonly publicDecks = signal<Deck[]>([]);
  readonly myDecks = signal<Deck[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadPublic(force = false): Promise<void> {
    if (this.publicLoaded && !force) return;
    await this.run(async () => {
      this.publicDecks.set(await firstValueFrom(this.api.listPublic()));
      this.publicLoaded = true;
    }, 'No se pudieron cargar los mazos públicos');
  }

  async loadMine(userId: string, force = false): Promise<void> {
    if (this.mineOwner === userId && !force) return;
    await this.run(async () => {
      this.myDecks.set(await firstValueFrom(this.api.listByUser(userId)));
      this.mineOwner = userId;
    }, 'No se pudieron cargar tus mazos');
  }

  getDeck(id: string): Promise<Deck> {
    return firstValueFrom(this.api.get(id));
  }

  /** Creates or updates; returns the saved deck. Throws a readable message on failure. */
  async save(id: string | null, request: DeckSaveRequest): Promise<Deck> {
    try {
      const saved = await firstValueFrom(id ? this.api.update(id, request) : this.api.create(request));
      this.invalidate();
      return saved;
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo guardar el mazo'), { cause: e });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete(id));
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo eliminar el mazo'), { cause: e });
    }
    this.myDecks.update((list) => list.filter((d) => d.id !== id));
    this.publicDecks.update((list) => list.filter((d) => d.id !== id));
  }

  private invalidate(): void {
    this.publicLoaded = false;
    this.mineOwner = null;
  }

  private async run(task: () => Promise<void>, fallback: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await task();
    } catch (e) {
      this.error.set(apiErrorMessage(e, fallback));
    } finally {
      this.loading.set(false);
    }
  }
}
