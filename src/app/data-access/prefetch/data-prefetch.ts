import { Injectable, effect, inject, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { PREFETCH_AFTER_MS } from '@core/navigation/preloading';
import { CardsStore } from '../cards/cards.store';
import { DecksStore } from '../decks/decks.store';
import { EditionsStore } from '../editions/editions.store';
import { HomeStore } from '../home/home.store';

/**
 * The data most screens use, read in the background a moment after someone signs in (the card catalog, the
 * editions, the home's news, their decks): the screens then open with it. Each store shares a read already on its way,
 * so a screen opened meanwhile does not ask again.
 */
@Injectable({ providedIn: 'root' })
export class DataPrefetch {
  private readonly auth = inject(AuthService);
  private readonly cards = inject(CardsStore);
  private readonly editions = inject(EditionsStore);
  private readonly home = inject(HomeStore);
  private readonly decks = inject(DecksStore);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      untracked(() => {
        clearTimeout(this.timer);
        if (id) this.timer = setTimeout(() => this.fetch(id), PREFETCH_AFTER_MS);
      });
    });
  }

  private fetch(userId: string): void {
    void this.editions.load();
    void this.home.load();
    void this.decks.loadMine(userId);
    void this.cards.load();
  }
}
