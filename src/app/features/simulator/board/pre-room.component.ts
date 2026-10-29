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
  template: `
    <div class="pre-room">
      <eras-card>
        <eras-stack [gap]="3">
          <eras-stack direction="row" [gap]="3" align="center" justify="space-between" wrap>
            <eras-stack [gap]="1">
              @if (game.editorRoom()) {
                <strong class="room">Partida de prueba</strong>
                <span class="muted">Juegas los dos lados: elige el mazo de cada uno.</span>
              } @else {
                <strong class="room">Sala {{ game.roomId() }}</strong>
                <span class="muted">Comparte el código o el enlace para que tu rival entre.</span>
              }
            </eras-stack>
            <eras-stack direction="row" [gap]="2" wrap>
              @if (!game.editorRoom()) {
                <button erasButton variant="secondary" size="sm" type="button" (click)="copy()">{{ copied() ? 'Copiado' : 'Copiar enlace' }}</button>
              }
              <button erasButton variant="ghost" size="sm" type="button" (click)="leave()">Salir de la sala</button>
            </eras-stack>
          </eras-stack>

          <div class="players">
            @for (p of seats(); track $index) {
              <div class="seat" [class.ready]="p?.ready" [class.playing]="game.editorRoom() && p?.userId === mine()?.userId">
                @if (p) {
                  <eras-stack direction="row" [gap]="2" align="center" justify="space-between">
                    <eras-stack direction="row" [gap]="2" align="center" wrap>
                      <strong>{{ p.username }}{{ p.userId === me() ? ' (tú)' : '' }}</strong>
                      @if (p.userId === game.state()?.hostId) {
                        <eras-badge>Dueño</eras-badge>
                      }
                    </eras-stack>
                    @if (!p.connected) {
                      <eras-badge tone="danger">Desconectado</eras-badge>
                    } @else if (p.ready) {
                      <eras-badge tone="success">Listo</eras-badge>
                    }
                  </eras-stack>
                  <span class="muted">{{ p.deckName ?? (p.deckId ? 'Mazo elegido' : 'Eligiendo mazo…') }}</span>
                  @if (starterOf(p); as s) {
                    <div class="starter">
                      <eras-game-card [imageUrl]="s.imageUrl" />
                      <span class="muted">Iniciador: {{ s.cardName }}</span>
                    </div>
                  }
                  @if (game.editorRoom()) {
                    @if (p.userId !== mine()?.userId) {
                      <button erasButton variant="secondary" size="sm" type="button" (click)="game.playSide(p.userId)">Elegir su mazo</button>
                    }
                  } @else if (game.isHost() && p.userId !== me()) {
                    <eras-stack direction="row" [gap]="2" align="center" wrap>
                      @if (!p.connected) {
                        <span class="muted">Puedes esperarlo o sacarlo de la sala.</span>
                      }
                      <button erasButton variant="danger" size="sm" type="button" (click)="game.kickPlayer(p.userId)">Sacar de la sala</button>
                    </eras-stack>
                  }
                } @else {
                  <strong class="muted">Esperando rival…</strong>
                  @if (canPlayAlone()) {
                    <span class="muted">O juega tú los dos lados: una partida de prueba con acciones manuales y cartas de prueba.</span>
                    <button erasButton variant="secondary" size="sm" type="button" [loading]="goingAlone()" (click)="playAlone()">Jugar solo los dos lados</button>
                    @if (aloneError(); as e) {
                      <span class="error">{{ e }}</span>
                    }
                  }
                }
              </div>
            }
          </div>

          <eras-stack direction="row" [gap]="2" align="center" wrap>
            <span>¿Quién empieza?</span>
            @if (game.isHost()) {
              @for (o of firstOptions(); track o.id) {
                <button erasButton size="sm" type="button" [variant]="firstChoice() === o.id ? 'primary' : 'secondary'" (click)="game.setFirstPlayer(o.id)">{{ o.label }}</button>
              }
            } @else {
              <strong>{{ firstLabel() }}</strong>
              <span class="muted">(lo elige el dueño de la sala)</span>
            }
          </eras-stack>

          <eras-stack direction="row" [gap]="2" align="center" wrap>
            <button erasButton type="button" [disabled]="!canReady()" (click)="game.setReady(!mine()?.ready)">
              {{ mine()?.ready ? 'Cancelar' : 'Comenzar partida' }}
            </button>
            <span class="muted">{{ readyHint() }}</span>
          </eras-stack>
        </eras-stack>
      </eras-card>

      @if (myStarters().length > 1) {
        <eras-card>
          <eras-stack [gap]="2">
            <eras-section-header [title]="game.editorRoom() ? 'Iniciador de ' + mine()?.username : 'Tu Iniciador'" />
            <div class="starters" role="group" aria-label="Iniciador">
              @for (s of myStarters(); track s.cardId) {
                <button type="button" class="pick" [class.chosen]="mine()?.starterCardId === s.cardId" [attr.aria-pressed]="mine()?.starterCardId === s.cardId" [attr.aria-label]="s.cardName" (click)="game.setStarter(s.cardId)">
                  <eras-game-card [imageUrl]="s.imageUrl" />
                </button>
              }
            </div>
          </eras-stack>
        </eras-card>
      }

      <eras-stack [gap]="3">
        <eras-stack direction="row" [gap]="3" align="end" justify="space-between" wrap>
          <eras-section-header [title]="game.editorRoom() ? 'Mazo de ' + mine()?.username : 'Tu mazo'" />
          <eras-form-field label="Buscar mazo">
            <input type="search" placeholder="Nombre del mazo…" [value]="search()" (input)="search.set($any($event.target).value)" />
          </eras-form-field>
        </eras-stack>
        @if (allDecks().length === 0) {
          <eras-empty-state title="Cargando mazos…"><eras-spinner /></eras-empty-state>
        } @else {
          <eras-grid minColumn="9.5rem" [gap]="3">
            @for (deck of matches(); track deck.id) {
              <div class="deck" [class.chosen]="mine()?.deckId === deck.id">
                <eras-deck-cover
                  [name]="deck.deckName"
                  [author]="myIds().has(deck.id) ? null : (deck.username ?? null)"
                  [imageUrl]="deck.deckImage ?? null"
                  [cardCount]="deck.cards.length"
                  [isPrivate]="!!deck.privateDeck"
                  (selected)="game.setDeck(deck.id)"
                />
              </div>
            } @empty {
              <eras-empty-state title="Ningún mazo coincide con la búsqueda" />
            }
          </eras-grid>
        }
      </eras-stack>
    </div>
  `,
  styles: `
    :host { display: block; block-size: 100%; overflow-y: auto; }
    .pre-room { display: grid; gap: var(--space-4); max-inline-size: 72rem; margin-inline: auto; padding-block-end: var(--space-4); }
    .room { font-size: var(--font-size-lg); }
    .muted { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .players { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: var(--space-3); }
    .seat {
      display: grid;
      gap: var(--space-2);
      align-content: start;
      padding: var(--space-3);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md);
    }
    .seat.ready { border-color: var(--color-success); }
    .error { color: var(--color-danger); font-size: var(--font-size-sm); }
    .seat.playing { box-shadow: 0 0 0 2px var(--color-primary); }
    .starter { --game-card-width: 5rem; display: flex; align-items: center; gap: var(--space-2); }
    .starters { --game-card-width: 6rem; display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .pick { padding: var(--space-1); border: 2px solid transparent; border-radius: var(--radius-md); background: none; cursor: pointer; }
    .pick:hover { border-color: var(--color-border); }
    .pick.chosen, .deck.chosen { border-color: var(--color-success); }
    .deck { border: 3px solid transparent; border-radius: var(--radius-md); }
    .pick:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  `,
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
