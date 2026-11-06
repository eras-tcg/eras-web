import { Injectable, computed, inject, signal } from '@angular/core';
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
  /** Loads on their way (public and own decks load apart: one ending does not end the other's). */
  private readonly running = signal(0);
  readonly loading = computed(() => this.running() > 0);
  readonly error = signal<string | null>(null);
  /** A load on its way, shared by whoever asks for the same meanwhile (a page opened during the prefetch). */
  private publicPending: Promise<void> | null = null;
  private minePending: { userId: string; promise: Promise<void> } | null = null;

  loadPublic(force = false): Promise<void> {
    if (this.publicLoaded && !force) return Promise.resolve();
    if (!force && this.publicPending) return this.publicPending;
    const pending = this.run(async () => {
      this.publicDecks.set(await firstValueFrom(this.api.listPublic()));
      this.publicLoaded = true;
    }, 'No se pudieron cargar los mazos públicos').finally(() => {
      if (this.publicPending === pending) this.publicPending = null;
    });
    this.publicPending = pending;
    return pending;
  }

  loadMine(userId: string, force = false): Promise<void> {
    if (this.mineOwner === userId && !force) return Promise.resolve();
    if (!force && this.minePending?.userId === userId) return this.minePending.promise;
    const promise = this.run(async () => {
      const decks = await firstValueFrom(this.api.listByUser(userId));
      // Another account signed in meanwhile: its decks are not these
      if (this.minePending && this.minePending.userId !== userId) return;
      this.myDecks.set(decks);
      this.mineOwner = userId;
    }, 'No se pudieron cargar tus mazos').finally(() => {
      if (this.minePending?.promise === promise) this.minePending = null;
    });
    this.minePending = { userId, promise };
    return promise;
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
    this.running.update((n) => n + 1);
    this.error.set(null);
    try {
      await task();
    } catch (e) {
      this.error.set(apiErrorMessage(e, fallback));
    } finally {
      this.running.update((n) => Math.max(0, n - 1));
    }
  }
}
