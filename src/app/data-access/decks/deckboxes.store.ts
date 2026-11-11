import { Injectable, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { ServerAccess } from '@core/server/server-access';
import { Observable, firstValueFrom } from 'rxjs';
import { DeckBox, DeckBoxSaveRequest } from './deckbox.model';
import { withDeckIn } from './deckbox-rules';
import { DeckBoxesApi } from './deckboxes.api';

/**
 * The signed-in player's deckboxes, in their order, loaded once per account. Writes throw a readable message and
 * keep the list as the server answers it. Before connecting (installed app) there are none.
 */
@Injectable({ providedIn: 'root' })
export class DeckBoxesStore {
  private readonly api = inject(DeckBoxesApi);
  private readonly access = inject(ServerAccess);
  private owner: string | null = null;
  private pending: { userId: string; promise: Promise<void> } | null = null;

  readonly boxes = signal<DeckBox[]>([]);
  readonly error = signal<string | null>(null);

  load(userId: string, force = false): Promise<void> {
    if (!this.access.allowed()) return Promise.resolve();
    if (this.owner === userId && !force) return Promise.resolve();
    if (!force && this.pending?.userId === userId) return this.pending.promise;
    const promise = (async () => {
      this.error.set(null);
      try {
        const boxes = await firstValueFrom(this.api.list());
        if (this.pending && this.pending.userId !== userId) return;
        this.boxes.set(sorted(boxes));
        this.owner = userId;
      } catch (e) {
        this.error.set(apiErrorMessage(e, 'No se pudieron cargar tus deckboxes'));
      }
    })().finally(() => {
      if (this.pending?.promise === promise) this.pending = null;
    });
    this.pending = { userId, promise };
    return promise;
  }

  async create(request: DeckBoxSaveRequest): Promise<DeckBox> {
    const created = await this.call(() => this.api.create(request), 'No se pudo crear la deckbox');
    this.boxes.update((list) => sorted([...list, created]));
    return created;
  }

  async update(id: string, request: DeckBoxSaveRequest): Promise<void> {
    const saved = await this.call(() => this.api.update(id, request), 'No se pudo guardar la deckbox');
    this.boxes.update((list) => list.map((b) => (b.id === id ? saved : b)));
  }

  async delete(id: string): Promise<void> {
    await this.call(() => this.api.delete(id), 'No se pudo borrar la deckbox');
    this.boxes.update((list) => list.filter((b) => b.id !== id));
  }

  /** Shows the new order at once and goes back to the previous one if the server refuses it. */
  async reorder(ids: string[]): Promise<void> {
    const before = this.boxes();
    const byId = new Map(before.map((b) => [b.id, b]));
    this.boxes.set(ids.map((id, order) => ({ ...byId.get(id)!, order })));
    try {
      this.boxes.set(sorted(await this.call(() => this.api.reorder(ids), 'No se pudo ordenar')));
    } catch (e) {
      this.boxes.set(before);
      throw e;
    }
  }

  /** Puts one of the player's decks in a deckbox (null: loose); shows it at once and undoes it if the server refuses. */
  async moveDeck(deckId: string, boxId: string | null): Promise<void> {
    const before = this.boxes();
    this.boxes.set(withDeckIn(before, deckId, boxId));
    try {
      this.boxes.set(sorted(await this.call(() => this.api.moveDeck(deckId, boxId), 'No se pudo mover el mazo')));
    } catch (e) {
      this.boxes.set(before);
      throw e;
    }
  }

  private async call<T>(request: () => Observable<T>, fallback: string): Promise<T> {
    try {
      return await firstValueFrom(request());
    } catch (e) {
      throw new Error(apiErrorMessage(e, fallback), { cause: e });
    }
  }
}

function sorted(boxes: DeckBox[]): DeckBox[] {
  return [...boxes].sort((a, b) => a.order - b.order);
}
