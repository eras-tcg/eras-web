import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { RoomsApi } from '@data/simulator/rooms.api';
import { firstValueFrom } from 'rxjs';
import { CardsStore } from '@data/cards/cards.store';
import { coverFinish, ownedCount, shineOf } from '@data/collection/collection-rules';
import { CollectionStore } from '@data/collection/collection.store';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, PlayerState } from '@data/simulator/simulator.model';
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
  private readonly rooms = inject(RoomsApi);
  private readonly collection = inject(CollectionStore);

  /** The owner waiting alone may play both sides (a test room, "solo mode"). */
  protected readonly canPlayAlone = computed(() => this.game.isHost() && !this.game.editorRoom() && !this.rival());
  protected readonly goingAlone = signal(false);
  protected readonly aloneError = signal<string | null>(null);

  protected async playAlone(): Promise<void> {
    const room = this.game.roomId();
    if (!room || this.goingAlone()) return;
    this.goingAlone.set(true);
    this.aloneError.set(null);
    try {
      // The room's broadcast brings the other side
      await firstValueFrom(this.rooms.playAlone(room));
    } catch (e) {
      this.aloneError.set(apiErrorMessage(e, 'No se pudo pasar a partida de prueba'));
    } finally {
      this.goingAlone.set(false);
    }
  }

  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly search = signal('');
  protected readonly copied = signal(false);

  protected readonly mine = computed(() => this.game.myState());
  private readonly rival = computed(() => this.game.opponentState());
  /** Me first, then the rival (or an empty seat). */
  protected readonly seats = computed<(PlayerState | null)[]>(() => [this.mine() ?? null, this.rival() ?? null]);

  protected readonly allDecks = computed(() => {
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
    if (this.game.editorRoom()) return result;
    for (const deck of this.allDecks()) {
      if (deck.cards.some((id) => { const card = byId.get(id); return !!card && !!this.cards.unprogrammedOf(card); })) {
        result.set(deck.id, 'Tiene cartas sin programar');
        continue;
      }
      const needed = new Map<string, number>();
      for (const id of deck.cards) needed.set(id, (needed.get(id) ?? 0) + 1);
      const lacking = [...needed].reduce((sum, [id, n]) => sum + Math.max(0, n - ownedCount(collection, id)), 0);
      if (lacking > 0) result.set(deck.id, `Te ${lacking === 1 ? 'falta 1 carta' : 'faltan ' + lacking + ' cartas'} de tu colección`);
    }
    return result;
  });

  protected chooseDeck(id: string): void {
    if (!this.unplayable().has(id)) this.game.setDeck(id);
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
  protected readonly firstLabel = computed(() => {
    const choice = this.firstChoice();
    if (choice === 'random') return 'Aleatorio';
    return choice === this.me() ? 'Tú' : (this.game.state()?.players?.[choice]?.username ?? 'Tu rival');
  });

  protected readonly canReady = computed(
    () => !!this.mine()?.deckId && !!this.mine()?.starterCardId && !!this.rival() && (!this.game.editorRoom() || !!this.rival()?.deckId),
  );
  protected readonly readyHint = computed(() => {
    const me = this.mine();
    if (!this.rival()) return 'Esperando a que entre tu rival.';
    if (!me?.deckId) return 'Elige tu mazo.';
    if (!me.starterCardId) return 'Tu mazo no tiene un Iniciador.';
    if (this.game.editorRoom()) return this.rival()?.deckId ? 'Empieza cuando confirmes.' : `Elige también el mazo de ${this.rival()?.username}.`;
    if (me.ready) return this.rival()?.ready ? 'Empezando…' : `Esperando que ${this.rival()?.username} confirme.`;
    return this.rival()?.ready ? `${this.rival()?.username} ya confirmó.` : 'La partida empieza cuando ambos confirman.';
  });

  constructor() {
    void this.cards.load();
    void this.decks.loadPublic();
    const id = this.auth.user()?.id;
    if (id) void this.decks.loadMine(id);
  }

  /** The starter chosen by a player, from their deck. */
  protected starterOf(p: PlayerState): CardSlot | null {
    return p.starterCardId ? (p.deck.find((c) => c.cardId === p.starterCardId) ?? null) : null;
  }

  /** Frees my seat (the board's exit guard sends it); the room passes on if I own it. */
  protected leave(): void {
    void this.router.navigateByUrl('/simulator');
  }

  protected async copy(): Promise<void> {
    await navigator.clipboard?.writeText(`${location.origin}/simulator/${this.game.roomId() ?? ''}`).catch(() => undefined);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  /** The player's finest copy of a deck's cover card shines over the cover. */
  protected coverShine(deck: Deck): 'foil' | 'prism' | null {
    return shineOf(coverFinish(deck, this.cards.cards(), this.collection.collection()));
  }
}
