import { NgTemplateOutlet } from '@angular/common';
import { siteOrigin } from '@core/http/api-config';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { CardsStore } from '@data/cards/cards.store';
import { coverFinish, ownedCount, shineOf } from '@data/collection/collection-rules';
import { CollectionStore } from '@data/collection/collection.store';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { GameStore } from '@data/simulator/game.store';
import { BotLevel, CardSlot, PlayerState } from '@data/simulator/simulator.model';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconButtonComponent } from '@ui/primitives/icon-button/icon-button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';

/**
 * The room before a game, in the hub's line (the top row of every screen, a "versus" of the two seats with their
 * starters and nameplates, and a big start): each player picks a deck and its starter (the deck's first Iniciador by default),
 * the room's owner (its creator) picks who goes first and may take the other player out, and the game starts
 * when both confirm. After a game "Cambiar mazo" comes back
 * here, in the same room.
 */
@Component({
  selector: 'eras-pre-room',
  imports: [
    NgTemplateOutlet,
    GridComponent,
    AlertComponent,
    ToggleGroupComponent,
    DeckCoverComponent,
    GameCardComponent,
    EmptyStateComponent,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    IconButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './pre-room.component.html',
  styleUrl: './pre-room.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreRoomComponent {
  protected readonly game = inject(GameStore);
  private readonly decks = inject(DecksStore);
  private readonly cards = inject(CardsStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly collection = inject(CollectionStore);

  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly search = signal('');
  protected readonly copied = signal(false);

  protected readonly mine = computed(() => this.game.myState());
  private readonly rival = computed(() => this.game.opponentState());
  /** Against the bot: the deck list picks the bot's deck instead of mine. */
  protected readonly pickingBot = signal(false);
  /** The deck the list marks as chosen: mine, or the bot's while picking it. */
  protected readonly pickedDeckId = computed(() => (this.pickingBot() ? this.rival()?.deckId : this.mine()?.deckId) ?? null);
  /**
   * Me first, then the rival (or an empty seat). In the Sala de pruebas the order stays put (the owner first): choosing the
   * other side's deck only moves the highlight, the seats do not swap.
   */
  protected readonly seats = computed<(PlayerState | null)[]>(() => {
    const seats = [this.mine() ?? null, this.rival() ?? null];
    const host = this.game.state()?.hostId;
    return this.game.editorRoom() && seats[1]?.userId === host ? [seats[1], seats[0]] : seats;
  });

  protected readonly allDecks = computed(() => {
    // Offline: the decks the engine was given (the starter decks, and mine as they were loaded)
    if (this.game.local()) return this.game.localDecks();
    const mine = this.decks.myDecks();
    const ids = new Set(mine.map((d) => d.id));
    return [...mine, ...this.decks.publicDecks().filter((d) => !ids.has(d.id))];
  });
  protected readonly myIds = computed(() => new Set(this.decks.myDecks().map((d) => d.id)));
  protected readonly matches = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.allDecks().filter((d) => d.deckName.toLowerCase().includes(q)) : this.allDecks();
  });

  /**
   * Decks that cannot be chosen, and why (the server refuses them too): with cards the simulator does not run yet, or
   * with copies the player lacks in their collection. A test room plays anything (cards are tried there by hand).
   */
  protected readonly unplayable = computed(() => {
    const byId = new Map(this.cards.cards().map((c) => [c.id, c]));
    const collection = this.collection.collection();
    const result = new Map<string, string>();
    // The bot owns no collection: only the cards the simulator runs count for its deck
    const forBot = this.pickingBot();
    if (this.game.editorRoom()) return result;
    // Offline there is no collection to check against: any deck the engine was given is played
    const checkCollection = !this.game.local();
    for (const deck of this.allDecks()) {
      if (deck.cards.some((id) => { const card = byId.get(id); return !!card && !!this.cards.unprogrammedOf(card); })) {
        result.set(deck.id, 'Tiene cartas sin programar');
        continue;
      }
      const needed = new Map<string, number>();
      for (const id of deck.cards) needed.set(id, (needed.get(id) ?? 0) + 1);
      if (forBot || !checkCollection) continue;
      const lacking = [...needed].reduce((sum, [id, n]) => sum + Math.max(0, n - ownedCount(collection, id)), 0);
      if (lacking > 0) result.set(deck.id, `Te ${lacking === 1 ? 'falta 1 carta' : 'faltan ' + lacking + ' cartas'} de tu colección`);
    }
    return result;
  });

  protected chooseDeck(id: string): void {
    if (this.unplayable().has(id)) return;
    this.game.setDeck(id, this.pickingBot());
    this.pickingBot.set(false);
  }

  /** The Iniciadores of my deck, one per card. */
  protected readonly myStarters = computed(() => {
    const seen = new Set<string>();
    return (this.mine()?.deck ?? []).filter((c) => c.starter && !seen.has(c.cardId) && !!seen.add(c.cardId));
  });

  protected readonly firstChoice = computed(() => this.game.state()?.firstChoice ?? 'random');
  protected readonly firstOptions = computed(() => [
    ...this.seats().filter((p): p is PlayerState => !!p).map((p) => ({ id: p.userId, label: !this.game.editorRoom() && p.userId === this.me() ? 'Yo' : p.username })),
    { id: 'random', label: 'Aleatorio' },
  ]);
  protected readonly firstToggle = computed<ToggleOption[]>(() => this.firstOptions().map((o) => ({ value: o.id, label: o.label })));

  /** Against the bot: its level, or a model to try instead (the server lists both; a model replaces the level). */
  protected readonly botLevel = computed<BotLevel>(() => this.game.state()?.botLevel ?? 'normal');
  protected readonly botChoices = computed(() => this.game.state()?.botChoices ?? [
    { id: 'easy', label: 'Fácil', kind: 'level' },
    { id: 'normal', label: 'Normal', kind: 'level' },
    { id: 'hard', label: 'Difícil', kind: 'level' },
  ]);
  protected readonly botLevels = computed<ToggleOption[]>(() =>
    this.botChoices().filter((c) => c.kind !== 'model').map((c) => ({ value: c.id, label: c.label })),
  );
  protected readonly botModels = computed(() => this.botChoices().filter((c) => c.kind === 'model'));
  /** The level the bot plays at, in words (ranked: the server picks it by the owner's strength). */
  protected readonly botLevelLabel = computed(() => this.botChoices().find((c) => c.id === this.botLevel())?.label ?? this.botLevel());
  /** The model being tried, or '' when the bot plays a level. */
  protected readonly botModel = computed(() => (this.botModels().some((m) => m.id === this.botLevel()) ? this.botLevel() : ''));
  /** Friendly or ranked (the owner chooses before the game). */
  protected readonly rankedToggle: ToggleOption[] = [
    { value: 'friendly', label: 'Amistosa' },
    { value: 'ranked', label: 'Ranked' },
  ];
  protected setRanked(kind: string): void {
    if ((kind === 'ranked') !== this.game.rankedRoom()) {
      this.game.setRanked(kind === 'ranked');
      this.pickingBot.set(false);
    }
  }
  /** Sala de pruebas: who plays the test rival's side. */
  protected readonly rivalToggle: ToggleOption[] = [
    { value: 'me', label: 'Yo (a mano)' },
    { value: 'bot', label: 'El bot' },
  ];
  protected readonly editorBot = computed(() => !!this.game.state()?.editorBot);
  /** Sala de pruebas: who plays the owner's own side, and the bot's level or model when it is a bot. */
  protected readonly selfToggle: ToggleOption[] = [
    { value: 'me', label: 'Yo' },
    { value: 'bot', label: 'Un bot' },
  ];
  protected readonly selfBot = computed(() => !!this.game.state()?.editorSelfBot);
  protected readonly selfBotLevel = computed(() => this.game.state()?.selfBotLevel ?? 'normal');
  protected setSelf(who: string): void {
    if ((who === 'bot') !== this.selfBot()) this.game.setEditorSelfBot(who === 'bot');
  }
  protected setRival(who: string): void {
    if ((who === 'bot') !== this.editorBot()) this.game.setEditorBot(who === 'bot');
  }
  /** A level, or a model to try; '' (no model) goes back to the normal level. */
  protected setBotLevel(level: string): void {
    const next = level || 'normal';
    if (next !== this.botLevel()) this.game.setBotLevel(next);
  }
  protected readonly firstLabel = computed(() => {
    const choice = this.firstChoice();
    if (choice === 'random') return 'Aleatorio';
    return choice === this.me() ? 'Tú' : (this.game.state()?.players?.[choice]?.username ?? 'Tu rival');
  });

  protected readonly canReady = computed(
    () => !!this.mine()?.deckId && !!this.mine()?.starterCardId && !!this.rival() && (!this.game.editorRoom() || !!this.rival()?.deckId),
  );
  /**
   * The start button says what tapping it does: "Listo" while the other side is not ready yet; "Comenzar partida" for
   * the owner when it completes both (the rival or the bot ready, or a test room, whose owner confirms both sides);
   * "Cancelar" once ready. No message under it.
   */
  protected readonly startLabel = computed(() => {
    if (this.mine()?.ready) return 'Cancelar';
    const completes = this.game.editorRoom() || !!this.rival()?.ready;
    return completes && this.game.isHost() ? 'Comenzar partida' : 'Listo';
  });

  /** A seat that can be tapped to choose its deck: the side not being chosen, in a test room or Modo solo (not ranked). */
  protected seatPickable(p: PlayerState): boolean {
    if (this.game.editorRoom()) return p.userId !== this.mine()?.userId;
    if (this.game.botRoom() && !this.game.rankedRoom()) return (p.userId === this.me()) === this.pickingBot();
    return false;
  }

  /** Tapping a seat (its card or its nameplate): its deck is the one chosen next. */
  protected pickSeat(p: PlayerState): void {
    if (!this.seatPickable(p)) return;
    if (this.game.editorRoom()) this.game.playSide(p.userId);
    else this.pickingBot.set(p.userId !== this.me());
  }

  constructor() {
    void this.cards.load();
    // Offline the list is the engine's (and the server is not there to ask)
    if (this.game.local()) return;
    void this.decks.loadPublic();
    const id = this.auth.user()?.id;
    if (id) void this.decks.loadMine(id);
  }

  /** The starter chosen by a player, from their deck list (of the rival's, the server sends only that card). */
  protected starterOf(p: PlayerState): CardSlot | null {
    return p.starterCardId ? (p.originalDeck.find((c) => c.cardId === p.starterCardId) ?? null) : null;
  }

  /**
   * Back: the Sala de pruebas and Modo solo to "Jugar" (where they started), an online room to the rooms (the board's
   * exit guard frees my seat; the room passes on if I own it).
   */
  protected leave(): void {
    void this.router.navigateByUrl(this.game.ownRoom() ? '/play' : '/simulator');
  }

  protected async copy(): Promise<void> {
    await navigator.clipboard?.writeText(`${siteOrigin()}/simulator/${this.game.roomId() ?? ''}`).catch(() => undefined);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  /** The player's finest copy of a deck's cover card shines over the cover. */
  protected coverShine(deck: Deck): 'foil' | 'prism' | null {
    return shineOf(coverFinish(deck, this.cards.cards(), this.collection.collection()));
  }
}
