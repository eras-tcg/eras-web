import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { PREFETCH_AFTER_MS } from '@core/navigation/preloading';
import { OnlineStatus } from '@core/server/online-status';
import { CardsStore } from '../cards/cards.store';
import { DecksStore } from '../decks/decks.store';
import { EditionsStore } from '../editions/editions.store';
import { HomeStore } from '../home/home.store';

/**
 * The data most screens use, read in the background a moment after someone signs in (the card catalog, the
 * editions, the home's news, their decks): the screens then open with it. Each store shares a read already on its way,
 * so a screen opened meanwhile does not ask again. Without the connection nothing is asked (it would only fail): it is
 * read once the connection is back. Their decks and the cards those need are also kept on the device for playing
 * offline (OfflineLibrarySync); signing out deletes them.
 */
@Injectable({ providedIn: 'root' })
export class DataPrefetch {
  private readonly auth = inject(AuthService);
  private readonly network = inject(OnlineStatus);
  private readonly cards = inject(CardsStore);
  private readonly editions = inject(EditionsStore);
  private readonly home = inject(HomeStore);
  private readonly decks = inject(DecksStore);
  private readonly injector = inject(Injector);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      const online = this.network.online();
      untracked(() => {
        clearTimeout(this.timer);
        if (id && online) this.timer = setTimeout(() => this.fetch(id), PREFETCH_AFTER_MS);
      });
    });
    this.auth.onSignOut(() => void import('../simulator/offline-library').then((m) => m.offlineLibrary.clear()));
  }

  private fetch(userId: string): void {
    void this.editions.load();
    void this.home.load();
    void this.decks.loadMine(userId);
    void this.cards.load();
    // Its own chunk: what keeps the decks for offline is not part of the first screen's code
    void import('../simulator/offline-library-sync').then((m) => this.injector.get(m.OfflineLibrarySync));
  }
}
