import { Injectable, Injector, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { AvatarStore } from '@core/auth/avatar.store';
import { PlaymatStore } from '@core/auth/playmat.store';
import { CardsStore } from '../cards/cards.store';
import { DecksStore } from '../decks/decks.store';
import { CardMeta, DriveCard } from '../cards/card.model';
import { Deck } from '../decks/deck.model';
import { ENGINE_BUILD } from './engine-build';
import { FinishedGame, LOCAL_USER_ID, LocalMatchConfig } from './engine-protocol';
import { GameStore } from './game.store';
import { OfflineDecks, StarterDecksFile, offlineDecks } from './local-decks';
import { LocalEngine } from './local-transport';
import { StoredLibrary, offlineLibrary } from './offline-library';
import { RoomsApi } from './rooms.api';
import { loadStarterDecks } from './starter-decks';

/** What an offline game's decks are made of: the live data where loaded, what this device kept otherwise. */
export interface OfflineSources {
  starters: StarterDecksFile | null;
  mine: readonly Deck[];
  images: readonly DriveCard[];
  meta: readonly CardMeta[];
  /** The player's decks come from the device (kept the last time they were loaded with the connection). */
  fromDevice: boolean;
  savedAt: number | null;
}

/**
 * The live decks and catalog when this visit loaded them (the player's decks only if they are theirs); otherwise the
 * ones kept on the device (a reload, an offline start). A catalog loaded live with the decks kept is fine too: the
 * kept decks are played with it.
 */
export function chooseSources(input: {
  starters: StarterDecksFile | null;
  userId: string | null;
  live: { decks: readonly Deck[]; decksOwner: string | null; images: readonly DriveCard[]; meta: readonly CardMeta[] };
  stored: StoredLibrary | null;
}): OfflineSources {
  const { live, stored, userId } = input;
  const liveDecks = !!userId && live.decksOwner === userId;
  const liveCatalog = live.images.length > 0 && live.meta.length > 0;
  const kept = stored && stored.userId === userId ? stored : null;
  return {
    starters: input.starters,
    mine: liveDecks ? live.decks : (kept?.decks ?? []),
    images: liveCatalog ? live.images : (kept?.images ?? []),
    meta: liveCatalog ? live.meta : (kept?.meta ?? []),
    fromDevice: !liveDecks && !!kept,
    savedAt: liveDecks ? null : (kept?.savedAt ?? null),
  };
}

/** The table's pictures that are not cards' (public/images): the back of every hidden card. */
const TABLE_PICTURES = ['/images/card-back.png'];

/** A seed for the game's chance and the bot's: a decimal string, as `LocalMatch` reads it (any 53 bits will do). */
export function randomSeed(): string {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return String((words[0] & 0x1fffff) * 2 ** 32 + words[1]);
}

/**
 * Modo solo sin conexión: a game against the bot played wholly in this browser (the engine in a Web Worker). It offers
 * the starter decks always and the player's own decks: loaded in this visit, or kept on the device the last time they
 * were (offline-library.ts); then the room is the same as online (its pre-room picks the deck and the bot's level).
 */
@Injectable({ providedIn: 'root' })
export class OfflineGame {
  private readonly engine = inject(LocalEngine);
  private readonly game = inject(GameStore);
  private readonly rooms = inject(RoomsApi);
  private readonly auth = inject(AuthService);
  private readonly cards = inject(CardsStore);
  private readonly decks = inject(DecksStore);
  private readonly avatar = inject(AvatarStore);
  private readonly playmat = inject(PlaymatStore);
  private readonly injector = inject(Injector);
  /** The engine's finished games are being kept (once per visit). */
  private recording = false;
  /** The room open now is a test room: its games are not kept. */
  private testRoom = false;
  /** The engine is loaded in this visit: an offline game starts without the connection. */
  readonly ready = signal(false);

  /**
   * The table's own pictures (the card back), fetched with the engine and kept by this page, so a game whose connection
   * goes after it starts still draws them (installed, the service worker keeps it too). The cards' pictures come from
   * the image host: offline, those the service worker kept (seen before, or "Descargar para jugar sin conexión").
   */
  private readonly pictures: HTMLImageElement[] = [];

  /** Loads the engine (its worker, code and cards) and the starter decks, if not yet. */
  async prepare(): Promise<void> {
    if (!this.pictures.length && typeof Image !== 'undefined') {
      for (const src of TABLE_PICTURES) {
        const picture = new Image();
        picture.src = src;
        this.pictures.push(picture);
      }
    }
    await Promise.all([this.engine.prepare(), this.starters()]);
    this.ready.set(true);
  }

  /** Where this player's offline decks come from now (chooseSources); the starter decks are fetched if needed. */
  async sources(): Promise<OfflineSources> {
    const userId = this.auth.user()?.id ?? null;
    const [starters, stored] = await Promise.all([this.starters().catch(() => null), userId ? offlineLibrary.load(userId) : null]);
    return chooseSources({
      starters,
      userId,
      live: { decks: this.decks.myDecks(), decksOwner: this.decks.myDecksOwner(), images: this.cards.imageList(), meta: this.cards.metaList() },
      stored,
    });
  }

  /** The decks an offline game offers now. */
  async decksNow(): Promise<OfflineDecks> {
    return offlineDecks(await this.sources());
  }

  /**
   * Opens an offline room for this player (joined, in its pre-room); resolves with its id. `editor`: a test room ("Sala de
   * pruebas" without the connection), the player on both sides; its games are not kept for rewards.
   */
  async start(editor = false): Promise<string> {
    await this.prepare();
    this.record();
    this.testRoom = editor;
    const { roomId } = await firstValueFrom(this.rooms.createLocal());
    const decks = await this.decksNow();
    const config: LocalMatchConfig = {
      seed: randomSeed(),
      decks: decks.specs,
      roomId,
      userId: this.auth.user()?.id ?? LOCAL_USER_ID,
      avatar: this.avatar.url(),
      playmat: this.playmat.url(),
      ...(editor ? { editor: true } : {}),
    };
    await this.game.connectLocal(config, decks.list);
    this.game.joinRoom(null);
    return roomId;
  }

  /**
   * Every game that reaches its end is kept on the device for the signed-in player (offline-games.ts), to be counted by
   * the server when they connect (the same rewards as a game against the server's bot); sent at once when connected.
   */
  private record(): void {
    if (this.recording) return;
    this.recording = true;
    this.engine.on((m) => {
      if (m.kind === 'finished') this.keep(m.game).catch((e: unknown) => console.warn('[partidas sin conexión]', e));
    });
  }

  private async keep(game: FinishedGame): Promise<void> {
    const userId = this.auth.user()?.id;
    // Only a signed-in player's games, played as them against the bot (a test room counts for nothing)
    if (!userId || game.userId !== userId || this.testRoom) return;
    const { offlineGameQueue, newGameId } = await import('./offline-games');
    await offlineGameQueue.add(userId, { ...game, id: newGameId(), engineBuild: ENGINE_BUILD });
    // Sent now if connected; otherwise the connection gate refuses it at once (nothing reaches the server) and it waits
    const { OfflineGamesUpload } = await import('./offline-games-upload');
    void this.injector.get(OfflineGamesUpload).send(userId);
  }

  private starters(): Promise<StarterDecksFile> {
    return loadStarterDecks();
  }
}
