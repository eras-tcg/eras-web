import { Injectable, computed, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { ServerAccess } from '@core/server/server-access';
import { firstValueFrom } from 'rxjs';
import { Deck } from '../decks/deck.model';
import { Edition } from '../editions/edition.model';
import { normalizeSlots, toSaveRequest } from './home-rules';
import { HomeApi } from './home.api';
import { SharedLoad } from '../shared/shared-load';
import { HomeContent, HomeNews } from './home.model';
import { DEFAULT_NEWS } from './default-news';
import { allNews } from './news-rules';
import { PLATFORM_NEWS } from './platform-news';

/**
 * Home page content (featured edition, the carousel's news, featured deck slots).
 * Editing works on a draft; `save()` persists it, `cancelEdit()` discards it.
 */
@Injectable({ providedIn: 'root' })
export class HomeStore {
  private readonly api = inject(HomeApi);
  private readonly access = inject(ServerAccess);

  private readonly saved = signal<HomeContent>({ edition: null, decks: normalizeSlots([]) });
  private readonly draft = signal<HomeContent | null>(null);
  private loaded = false;
  private readonly loader = new SharedLoad(() => this.fetch(), () => this.loaded);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly editing = computed(() => this.draft() !== null);
  readonly content = computed(() => this.draft() ?? this.saved());
  /** The carousel's news: the saved ones (or the draft's), DEFAULT_NEWS while none were ever saved. */
  readonly news = computed<HomeNews[]>(() => this.content().news ?? DEFAULT_NEWS);
  /** Every news item of the platform, newest first: these and the platform's history (the news log; the carousel shows the latest). */
  readonly allNews = computed<HomeNews[]>(() => allNews(this.news(), PLATFORM_NEWS));

  /** Loads it unless already loaded; a load already on its way is shared (a page opened during the prefetch waits for it). */
  load(force = false): Promise<void> {
    // The installed app before connecting (ServerAccess): the home shows its news without the featured content
    if (!this.access.allowed()) return Promise.resolve();
    return this.loader.run(force);
  }

  private async fetch(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.get());
      this.saved.set({ edition: data.edition ?? null, decks: normalizeSlots(data.decks), news: data.news ?? null });
      this.loaded = true;
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo cargar la portada'));
    } finally {
      this.loading.set(false);
    }
  }

  /** A draft of the saved content; its news start from DEFAULT_NEWS when none were ever saved (saving keeps them). */
  startEdit(): void {
    const saved = structuredClone(this.saved());
    this.draft.set({ ...saved, news: saved.news ?? structuredClone(DEFAULT_NEWS) });
  }

  cancelEdit(): void {
    this.draft.set(null);
  }

  setEdition(edition: Edition): void {
    this.draft.update((d) => d && { ...d, edition });
  }

  setNews(news: HomeNews[]): void {
    this.draft.update((d) => d && { ...d, news });
  }

  setDeck(slot: number, deck: Deck | null): void {
    this.draft.update((d) => d && { ...d, decks: d.decks.map((current, i) => (i === slot ? deck : current)) });
  }

  /** Persists the draft. Throws a readable message on failure (the draft is kept). */
  async save(): Promise<void> {
    const draft = this.draft();
    if (!draft) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.save(toSaveRequest(draft)));
      this.saved.set(draft);
      this.draft.set(null);
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo guardar la portada'), { cause: e });
    } finally {
      this.saving.set(false);
    }
  }
}
