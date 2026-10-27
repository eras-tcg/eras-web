import { Injectable, computed, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { Deck } from '../decks/deck.model';
import { Edition } from '../editions/edition.model';
import { normalizeSlots, toSaveRequest } from './home-rules';
import { HomeApi } from './home.api';
import { HomeContent } from './home.model';

/**
 * Home page content (featured edition + featured deck slots).
 * Editing works on a draft; `save()` persists it, `cancelEdit()` discards it.
 */
@Injectable({ providedIn: 'root' })
export class HomeStore {
  private readonly api = inject(HomeApi);

  private readonly saved = signal<HomeContent>({ edition: null, decks: normalizeSlots([]) });
  private readonly draft = signal<HomeContent | null>(null);
  private loaded = false;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly editing = computed(() => this.draft() !== null);
  readonly content = computed(() => this.draft() ?? this.saved());

  async load(force = false): Promise<void> {
    if (this.loaded && !force) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.get());
      this.saved.set({ edition: data.edition ?? null, decks: normalizeSlots(data.decks) });
      this.loaded = true;
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo cargar la portada'));
    } finally {
      this.loading.set(false);
    }
  }

  startEdit(): void {
    this.draft.set(structuredClone(this.saved()));
  }

  cancelEdit(): void {
    this.draft.set(null);
  }

  setEdition(edition: Edition): void {
    this.draft.update((d) => d && { ...d, edition });
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
