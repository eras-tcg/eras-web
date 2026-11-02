import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { CollectionApi } from './collection.api';
import { Collection, Finish } from './collection.model';
import { extraCopies, ownedCount } from './collection-rules';

/**
 * The signed-in player's cards and fragments, kept by the server: loaded for whoever signs in, and replaced by what
 * the server answers after each change (break, craft). Openings add to it on the server; `load(true)` reads it again.
 */
@Injectable({ providedIn: 'root' })
export class CollectionStore {
  private readonly api = inject(CollectionApi);
  private readonly auth = inject(AuthService);

  readonly collection = signal<Collection | null>(null);
  readonly busy = signal(false);
  /** Why the last change was refused, in Spanish (null when it went through). */
  readonly error = signal<string | null>(null);
  readonly fragments = computed(() => this.collection()?.fragments ?? {});
  readonly extras = computed(() => extraCopies(this.collection()));

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      untracked(() => {
        this.collection.set(null);
        if (id) void this.load();
      });
    });
  }

  /** Copies of a card, every finish together. */
  owned(cardId: string): number {
    return ownedCount(this.collection(), cardId);
  }

  async load(): Promise<void> {
    try {
      this.collection.set(await firstValueFrom(this.api.mine()));
    } catch {
      // An older server without collections: nothing owned
    }
  }

  breakCopies(cardId: string, finish: Finish, count: number): Promise<boolean> {
    return this.change(() => firstValueFrom(this.api.breakCopies(cardId, finish, count)), 'No se pudo romper la carta');
  }

  /** The finishes crafted, in order (empty when refused: `error` says why). */
  async craft(cardId: string, count: number): Promise<Finish[]> {
    return this.crafting(() => firstValueFrom(this.api.craft(cardId, count)));
  }

  async craftUntil(cardId: string, finish: Finish): Promise<Finish[]> {
    return this.crafting(() => firstValueFrom(this.api.craftUntil(cardId, finish)));
  }

  breakExtras(): Promise<boolean> {
    return this.change(() => firstValueFrom(this.api.breakExtras()), 'No se pudieron romper las copias sobrantes');
  }

  private async crafting(request: () => Promise<{ finishes: Finish[]; collection: Collection }>): Promise<Finish[]> {
    let finishes: Finish[] = [];
    await this.change(async () => {
      const crafted = await request();
      finishes = crafted.finishes;
      return crafted.collection;
    }, 'No se pudo fabricar la carta');
    return finishes;
  }

  private async change(request: () => Promise<Collection>, fallback: string): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.collection.set(await request());
      return true;
    } catch (e) {
      this.error.set(apiErrorMessage(e, fallback));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
