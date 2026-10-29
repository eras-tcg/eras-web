import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { EditModeService } from '@core/auth/edit-mode.service';
import { apiErrorMessage } from '@core/http/api-error';
import { RoomsApi } from '@data/simulator/rooms.api';
import { firstValueFrom } from 'rxjs';
import { DecksStore } from '@data/decks/decks.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, PlayerState } from '@data/simulator/simulator.model';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';

/**
 * The room before a game: each player picks a deck and its starter (the deck's first Iniciador by default),
 * the room's owner (its creator) picks who goes first and may take the other player out, and the game starts
 * when both confirm. After a game "Cambiar mazo" comes back
 * here, in the same room.
 */
@Component({
  selector: 'eras-pre-room',
  imports: [
    StackComponent,
    GridComponent,
    SectionHeaderComponent,
    FormFieldComponent,
    DeckCoverComponent,
    GameCardComponent,
    EmptyStateComponent,
    BadgeComponent,
    ButtonComponent,
    SpinnerComponent,
    CardComponent,
  ],
  templateUrl: './pre-room.component.html',
  styleUrl: './pre-room.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreRoomComponent {
  protected readonly game = inject(GameStore);
  private readonly decks = inject(DecksStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly rooms = inject(RoomsApi);
  private readonly editMode = inject(EditModeService);

  /** In the site's edit mode, the owner waiting alone may play both sides (a test room). */
  protected readonly canPlayAlone = computed(() => this.editMode.active() && this.game.isHost() && !this.game.editorRoom() && !this.rival());
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

  /** The Iniciadores of my deck, one per card. */
  protected readonly myStarters = computed(() => {
    const seen = new Set<string>();
    return (this.mine()?.deck ?? []).filter((c) => c.starter && !seen.has(c.cardId) && !!seen.add(c.cardId));
  });

  protected readonly firstChoice = computed(() => this.game.state()?.firstChoice ?? 'random');
  protected readonly firstOptions = computed(() => [
    ...this.seats().filter((p): p is PlayerState => !!p).map((p) => ({ id: p.userId, label: p.userId === this.me() ? 'Yo' : p.username })),
    { id: 'random', label: 'Aleatorio' },
  ]);
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
}
