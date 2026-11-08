import { ENGINE_BUILD } from './engine-build';
import type { StarterDecksFile } from './local-decks';

let file: Promise<StarterDecksFile> | null = null;

/**
 * The starter decks (vendor/eras-engine/starter-decks.json, served at /engine), fetched once per page; a failure may
 * be tried again. Installed, the service worker serves them without the connection.
 */
export function loadStarterDecks(base: string = document.baseURI): Promise<StarterDecksFile> {
  file ??= fetch(new URL(`engine/starter-decks.json?v=${ENGINE_BUILD}`, base).href)
    .then((r) => {
      if (!r.ok) throw new Error(`starter-decks.json: ${r.status}`);
      return r.json() as Promise<StarterDecksFile>;
    })
    .catch((e: unknown) => {
      file = null;
      throw e;
    });
  return file;
}
