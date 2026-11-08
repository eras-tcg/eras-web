import { Injectable, computed, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { ServerAccess } from '@core/server/server-access';
import { firstValueFrom } from 'rxjs';
import { Edition, EditionSaveRequest } from './edition.model';
import { sortEditions } from './edition-rules';
import { EditionsApi } from './editions.api';

/** Where the last editions read are kept on the device (IndexedDB "eras"/kv): the installed app shows them before connecting. */
const KEPT_KEY = 'editions';

/**
 * Editions state shared by every page that needs them (cached after the first load). The installed app before
 * connecting (ServerAccess) shows the ones kept on the device the last time they were read (the hub's artwork), and
 * reads them for real once connected.
 */
@Injectable({ providedIn: 'root' })
export class EditionsStore {
  private readonly api = inject(EditionsApi);
  private readonly access = inject(ServerAccess);

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
    if (!this.access.allowed()) return this.loadKept();
    this.loading.set(true);
    this.error.set(null);
    try {
      const items = await firstValueFrom(this.api.list());
      this.items.set(items);
      this.loaded.set(true);
      void import('@core/storage/kv-store').then(({ erasStore }) => erasStore.set(KEPT_KEY, items)).catch(() => undefined);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudieron cargar las ediciones'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Not connected: the editions kept on the device, if any (not marked loaded: connecting reads them). */
  private async loadKept(): Promise<void> {
    try {
      const { erasStore } = await import('@core/storage/kv-store');
      const kept = await erasStore.get<Edition[]>(KEPT_KEY);
      if (kept?.length && !this.loaded()) this.items.set(kept);
    } catch {
      // Nothing kept (or no IndexedDB): no artwork until connected
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
