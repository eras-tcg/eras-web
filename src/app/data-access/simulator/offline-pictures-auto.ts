import { Injectable, inject, signal } from '@angular/core';
import { detectAppMode } from '@core/pwa/app-mode';
import { costlyConnection, persistStorage } from '@core/pwa/device-storage';
import { persistedFlag } from '@core/storage/persisted-flag';
import { PictureProgress, canKeepPictures, keepPictures, missingPictures } from './card-images';
import { offlinePictures } from './local-decks';
import { OfflineGame } from './offline-game';

/**
 * Whether the card pictures are kept by themselves now: the installed app always, the browser when the player turned
 * on "Guardar el juego para jugar sin conexión" (`wanted`, in the profile); if they can be kept, and the connection is
 * not one to spare (Save-Data, mobile data or 2G: then it waits for the next connection on wifi). Null connection
 * info (Safari) = go ahead.
 */
export function shouldKeepPicturesNow(state: {
  app: boolean;
  wanted?: boolean;
  canKeep: boolean;
  connection: { saveData: boolean; metered: boolean; slow: boolean } | null;
}): boolean {
  if (!(state.app || state.wanted) || !state.canKeep) return false;
  const c = state.connection;
  return !c || !(c.saveData || c.metered || c.slow);
}

/**
 * Keeps what an offline game shows: after each sync of the player's library (on connecting), the pictures of the
 * starter decks and the saved decks not kept yet are downloaded in the background, and the browser is asked to keep
 * the site's storage. The installed app does it always; the browser when the player turns it on in the profile (then
 * at once, whatever the connection: they asked for it). One run at a time; a failure is tried again next time.
 */
@Injectable({ providedIn: 'root' })
export class OfflinePicturesAuto {
  private readonly offline = inject(OfflineGame);
  /** The player's "Guardar el juego para jugar sin conexión" (the installed app keeps them anyway). */
  readonly wanted = persistedFlag('eras-keep-offline');
  readonly app = detectAppMode() === 'app';
  readonly canKeep = canKeepPictures();
  /** The download in progress, null when none. */
  readonly progress = signal<PictureProgress | null>(null);
  /** How many of the pictures an offline game shows are kept, once counted. */
  readonly kept = signal<{ kept: number; total: number } | null>(null);
  private running = false;

  /** After a sync: only when it should (see shouldKeepPicturesNow). `now`: the player asked, whatever the connection. */
  async run(now = false): Promise<number> {
    if (this.running) return 0;
    const connection = now ? null : costlyConnection();
    if (!shouldKeepPicturesNow({ app: this.app, wanted: this.wanted(), canKeep: this.canKeep, connection })) return 0;
    this.running = true;
    try {
      const all = offlinePictures(await this.offline.decksNow());
      const missing = await missingPictures(all);
      this.kept.set({ kept: all.length - missing.length, total: all.length });
      if (!missing.length) return 0;
      void persistStorage();
      const result = await keepPictures(missing, { signal: new AbortController().signal, progress: (p) => this.progress.set(p) });
      return result.done - result.failed;
    } catch {
      return 0;
    } finally {
      this.running = false;
      this.progress.set(null);
      void this.count();
    }
  }

  /** Counts what is kept (for the profile). */
  async count(): Promise<void> {
    try {
      const all = offlinePictures(await this.offline.decksNow());
      const missing = await missingPictures(all);
      this.kept.set({ kept: all.length - missing.length, total: all.length });
    } catch {
      this.kept.set(null);
    }
  }
}
