import { Injectable, inject } from '@angular/core';
import { detectAppMode } from '@core/pwa/app-mode';
import { costlyConnection, persistStorage } from '@core/pwa/device-storage';
import { canKeepPictures, keepPictures, missingPictures } from './card-images';
import { offlinePictures } from './local-decks';
import { OfflineGame } from './offline-game';

/**
 * Whether the installed app keeps the card pictures by itself now: it is the app (the browser's tab keeps the
 * "Descargar para jugar sin conexión" button), it can keep them, and the connection is not one to spare (Save-Data,
 * mobile data or 2G: then it waits for the next connection on wifi). Null connection info (Safari) = go ahead.
 */
export function shouldKeepPicturesNow(state: {
  app: boolean;
  canKeep: boolean;
  connection: { saveData: boolean; metered: boolean; slow: boolean } | null;
}): boolean {
  if (!state.app || !state.canKeep) return false;
  const c = state.connection;
  return !c || !(c.saveData || c.metered || c.slow);
}

/**
 * The installed app keeps what an offline game shows by itself: after each sync of the player's library (on
 * connecting), the pictures of the starter decks and the saved decks not kept yet are downloaded in the background,
 * and the browser is asked to keep the site's storage. One run at a time; a failure is tried again next time.
 */
@Injectable({ providedIn: 'root' })
export class OfflinePicturesAuto {
  private readonly offline = inject(OfflineGame);
  private running = false;

  async run(): Promise<number> {
    if (this.running) return 0;
    if (!shouldKeepPicturesNow({ app: detectAppMode() === 'app', canKeep: canKeepPictures(), connection: costlyConnection() })) return 0;
    this.running = true;
    try {
      const missing = await missingPictures(offlinePictures(await this.offline.decksNow()));
      if (!missing.length) return 0;
      void persistStorage();
      const result = await keepPictures(missing, { signal: new AbortController().signal });
      return result.done - result.failed;
    } catch {
      return 0;
    } finally {
      this.running = false;
    }
  }
}
