import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { ServerAccess } from '@core/server/server-access';
import { firstValueFrom } from 'rxjs';
import { Edition, EditionSaveRequest } from './edition.model';
import { isTestEdition, sortEditions } from './edition-rules';
import { EditionsApi } from './editions.api';
import { SharedLoad } from '../shared/shared-load';

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
  private readonly auth = inject(AuthService);

  private readonly items = signal<Edition[]>([]);
  private readonly loaded = signal(false);
  private readonly loader = new SharedLoad(() => this.fetch(), () => this.loaded());

  constructor() {
    // What is listed depends on who asks (testing editions need a permission): another user reads them again
    let user: string | null | undefined;
    effect(() => {
      const now = this.auth.user()?.id ?? null;
      if (user !== undefined && now !== user && untracked(this.loaded)) void this.load(true);
      user = now;
    });
  }

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** The released editions (the shop, the editions page, the hub): never a testing one. */
  readonly editions = computed(() => sortEditions(this.items().filter((e) => !isTestEdition(e.editionId))));
  /** Every edition the player may filter the cards by: the released ones and, for a tester, the testing ones (T1…). */
  readonly catalogEditions = computed(() => sortEditions(this.items()));
  readonly releaseDates = computed(() => new Map(this.items().map((e) => [e.editionId, e.releaseDate ?? ''])));

  /** Loads it unless already loaded; a load already on its way is shared (a page opened during the prefetch waits for it). */
  load(force = false): Promise<void> {
    return this.loader.run(force);
  }

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

  /** Sets an edition's cover and reloads the list. Throws a readable message on failure. */
  async setImage(editionId: string, file: Blob): Promise<void> {
    try {
      await firstValueFrom(this.api.setImage(editionId, file));
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo guardar la portada'), { cause: e });
    }
    await this.load(true);
  }
}
