import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { AvatarStore } from '@core/auth/avatar.store';
import { PlaymatStore } from '@core/auth/playmat.store';
import { CardsStore } from '../cards/cards.store';
import { DecksStore } from '../decks/decks.store';
import { ENGINE_BUILD } from './engine-build';
import { LOCAL_USER_ID, LocalMatchConfig } from './engine-protocol';
import { GameStore } from './game.store';
import { StarterDecksFile, offlineDecks } from './local-decks';
import { LocalEngine } from './local-transport';
import { RoomsApi } from './rooms.api';

/** The table's pictures that are not cards' (public/images): the back of every hidden card. */
const TABLE_PICTURES = ['/images/card-back.png'];

/** A seed for the game's chance and the bot's: a decimal string, as `LocalMatch` reads it (any 53 bits will do). */
export function randomSeed(): string {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return String((words[0] & 0x1fffff) * 2 ** 32 + words[1]);
}

/**
 * Modo solo sin conexión: a game against the bot played wholly in this browser (the engine in a Web Worker). It offers
 * the starter decks always and the player's own decks when they and the card catalog are loaded; then the room is
 * the same as online (its pre-room picks the deck and the bot's level).
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
  private startersFile: Promise<StarterDecksFile> | null = null;
  /** The engine is loaded in this visit: an offline game starts without the connection. */
  readonly ready = signal(false);

  /**
   * The table's own pictures (the card back), fetched with the engine and kept by this page, so a game whose connection
   * goes after it starts still draws them. The cards' pictures come from the image host: offline only those the browser
   * already had are seen (the others show their name).
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

  /** Opens an offline room for this player (joined, in its pre-room); resolves with its id. */
  async start(): Promise<string> {
    await this.prepare();
    const starters = await this.starters();
    const { roomId } = await firstValueFrom(this.rooms.createLocal());
    const decks = offlineDecks({ starters, mine: this.decks.myDecks(), images: this.cards.imageList(), meta: this.cards.metaList() });
    const config: LocalMatchConfig = {
      seed: randomSeed(),
      decks: decks.specs,
      roomId,
      userId: this.auth.user()?.id ?? LOCAL_USER_ID,
      avatar: this.avatar.url(),
      playmat: this.playmat.url(),
    };
    await this.game.connectLocal(config, decks.list);
    this.game.joinRoom(null);
    return roomId;
  }

  private starters(): Promise<StarterDecksFile> {
    this.startersFile ??= fetch(new URL(`engine/starter-decks.json?v=${ENGINE_BUILD}`, document.baseURI).href)
      .then((r) => {
        if (!r.ok) throw new Error(`starter-decks.json: ${r.status}`);
        return r.json() as Promise<StarterDecksFile>;
      })
      .catch((e: unknown) => {
        this.startersFile = null;
        throw e;
      });
    return this.startersFile;
  }
}
