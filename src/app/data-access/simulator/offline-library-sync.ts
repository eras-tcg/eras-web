import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { CardsStore } from '../cards/cards.store';
import { DecksStore } from '../decks/decks.store';
import { libraryRecord, offlineLibrary } from './offline-library';
import { loadStarterDecks } from './starter-decks';

/** A burst of changes (a deck saved, the catalog and the decks arriving one after the other) is written once. */
const SAVE_AFTER_MS = 1500;

/**
 * Keeps the signed-in player's decks, and the part of the card catalog they need, on this device whenever they are
 * loaded with the connection (DataPrefetch loads both after signing in), so "Modo solo sin conexión" offers them after
 * a reload or an offline start. Made (lazily) by DataPrefetch once the player is connected. It also sends the games
 * played offline against the bot since, to be counted (OfflineGamesUpload, its own chunk): now, after each sync of the
 * library (the connection back reloads the decks), and when another player signs in.
 */
@Injectable({ providedIn: 'root' })
export class OfflineLibrarySync {
  private readonly auth = inject(AuthService);
  private readonly decks = inject(DecksStore);
  private readonly cards = inject(CardsStore);
  private readonly injector = inject(Injector);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      if (userId) untracked(() => this.sendGames(userId));
    });
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      const owner = this.decks.myDecksOwner();
      // Read so a deck saved or deleted is kept again
      this.decks.myDecks();
      const images = this.cards.imageList();
      const meta = this.cards.metaList();
      untracked(() => {
        clearTimeout(this.timer);
        if (!userId || owner !== userId || !images.length || !meta.length) return;
        this.timer = setTimeout(() => void this.save(userId), SAVE_AFTER_MS);
      });
    });
  }

  private async save(userId: string): Promise<void> {
    const starters = await loadStarterDecks().catch(() => null);
    // Signed out (or another account) meanwhile: not these decks
    if (this.auth.user()?.id !== userId || this.decks.myDecksOwner() !== userId) return;
    await offlineLibrary.save(
      libraryRecord(userId, { decks: this.decks.myDecks(), images: this.cards.imageList(), meta: this.cards.metaList(), starters }),
    );
    this.sendGames(userId);
  }

  private sendGames(userId: string): void {
    // (The page may be gone meanwhile: then nothing is sent)
    import('./offline-games-upload')
      .then((m) => this.injector.get(m.OfflineGamesUpload).send(userId))
      .catch(() => undefined);
  }
}
