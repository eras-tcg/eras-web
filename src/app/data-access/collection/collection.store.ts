import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ServerAccess } from '@core/server/server-access';
import { apiErrorMessage } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { CollectionApi } from './collection.api';
import { Collection, Finish } from './collection.model';
import { FINISHES, breakPlan, extraCopies, ownedCount } from './collection-rules';

/**
 * The signed-in player's cards and fragments, kept by the server: loaded for whoever signs in, and replaced by what
 * the server answers after each change (break, craft). Openings add to it on the server; `load(true)` reads it again.
 */
@Injectable({ providedIn: 'root' })
export class CollectionStore {
  private readonly api = inject(CollectionApi);
  private readonly auth = inject(AuthService);
  /** The installed app asks the server nothing before connecting (ServerAccess). */
  private readonly access = inject(ServerAccess);

  readonly collection = signal<Collection | null>(null);
  readonly busy = signal(false);
  /** Why the last change was refused, in Spanish (null when it went through). */
  readonly error = signal<string | null>(null);
  readonly fragments = computed(() => this.collection()?.fragments ?? {});
  readonly extras = computed(() => extraCopies(this.collection()));

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      const allowed = this.access.allowed();
      untracked(() => {
        this.collection.set(null);
        if (id && allowed) void this.load();
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

  /** Crafts several cards at once (card id → copies): all of them or none. */
  async craftMany(cards: Record<string, number>): Promise<Finish[]> {
    return this.crafting(() => firstValueFrom(this.api.craftMany(cards)));
  }

  async craftUntil(cardId: string, finish: Finish, maxFragments: number): Promise<Finish[]> {
    return this.crafting(() => firstValueFrom(this.api.craftUntil(cardId, finish, maxFragments)));
  }

  /** Breaks `count` copies of a card, the plainest first (see breakPlan). */
  async breakMany(cardId: string, count: number): Promise<boolean> {
    const plan = breakPlan(this.collection()?.cards[cardId], count);
    for (const finish of FINISHES) {
      const n = plan[finish] ?? 0;
      if (n > 0 && !(await this.breakCopies(cardId, finish, n))) return false;
    }
    return true;
  }

  /** Sets the signed-in account's fragments (administrators, to test). */
  setFragments(fragments: Record<string, number>): Promise<boolean> {
    const id = this.auth.user()?.id;
    if (!id) return Promise.resolve(false);
    return this.change(() => firstValueFrom(this.api.setFragments(id, fragments)), 'No se pudieron guardar los fragmentos');
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
