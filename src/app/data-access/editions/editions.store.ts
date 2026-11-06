import { Injectable, computed, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { Edition, EditionSaveRequest } from './edition.model';
import { sortEditions } from './edition-rules';
import { EditionsApi } from './editions.api';

/** Editions state shared by every page that needs them (cached after the first load). */
@Injectable({ providedIn: 'root' })
export class EditionsStore {
  private readonly api = inject(EditionsApi);

  private readonly items = signal<Edition[]>([]);
  private readonly loaded = signal(false);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly editions = computed(() => sortEditions(this.items()));
  readonly releaseDates = computed(() => new Map(this.items().map((e) => [e.editionId, e.releaseDate ?? ''])));

  /** Loads it unless already loaded; a load already on its way is shared (a page opened during the prefetch waits for it). */
  load(force = false): Promise<void> {
    if (!force && this.loaded()) return Promise.resolve();
    if (!force && this.pending) return this.pending;
    const pending = this.fetch().finally(() => {
      if (this.pending === pending) this.pending = null;
    });
    this.pending = pending;
    return pending;
  }

  private pending: Promise<void> | null = null;

  private async fetch(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.list()));
      this.loaded.set(true);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudieron cargar las ediciones'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Saves and reloads the list. Throws a readable message on failure. */
  async save(request: EditionSaveRequest): Promise<void> {
    try {
      await firstValueFrom(this.api.save(request));
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo guardar la edición'), { cause: e });
    }
    await this.load(true);
  }
}
