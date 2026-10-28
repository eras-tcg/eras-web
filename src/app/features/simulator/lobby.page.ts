import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { DecksStore } from '@data/decks/decks.store';
import { GameStore } from '@data/simulator/game.store';
import { RoomsApi } from '@data/simulator/rooms.api';
import { RoomStatus, STATUS_LABELS } from '@data/simulator/simulator.model';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';

/**
 * Simulator lobby: picking a deck is the whole flow. Without a room it creates one and enters it (the board
 * shows the link to share); with a shared room link it joins that room. Players already in the room can
 * reconnect without choosing a deck.
 */
@Component({
  selector: 'eras-lobby-page',
  imports: [
    PageComponent,
    StackComponent,
    GridComponent,
    SectionHeaderComponent,
    FormFieldComponent,
    DeckCoverComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    SpinnerComponent,
  ],
  templateUrl: './lobby.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyPage {
  /** Route param of /simulator/:roomId (absent on /simulator). */
  readonly roomId = input<string>();

  private readonly auth = inject(AuthService);
  private readonly decks = inject(DecksStore);
  private readonly rooms = inject(RoomsApi);
  private readonly game = inject(GameStore);
  private readonly router = inject(Router);

  /** Deck id being entered with, 'reconnect', or null. */
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly roomStatus = signal<RoomStatus | null>(null);
  protected readonly alreadyIn = signal(false);

  /** Own decks first, then public ones not already listed. */
  protected readonly allDecks = computed(() => {
    const mine = this.decks.myDecks();
    const ids = new Set(mine.map((d) => d.id));
    return [...mine, ...this.decks.publicDecks().filter((d) => !ids.has(d.id))];
  });
  private readonly matches = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.allDecks().filter((d) => d.deckName.toLowerCase().includes(q)) : this.allDecks();
  });
  private readonly myIds = computed(() => new Set(this.decks.myDecks().map((d) => d.id)));
  protected readonly mine = computed(() => this.matches().filter((d) => this.myIds().has(d.id)));
  protected readonly others = computed(() => this.matches().filter((d) => !this.myIds().has(d.id)));
  protected readonly statusLabel = computed(() => (this.roomStatus() ? STATUS_LABELS[this.roomStatus()!] : ''));

  constructor() {
    const me = this.auth.user()?.id;
    void this.decks.loadPublic();
    if (me) void this.decks.loadMine(me);

    effect(() => {
      const room = this.roomId();
      untracked(() => void this.checkRoom(room));
    });
  }

  private async checkRoom(room: string | undefined): Promise<void> {
    this.roomStatus.set(null);
    this.alreadyIn.set(false);
    if (!room) return;
    try {
      const info = await firstValueFrom(this.rooms.get(room));
      this.roomStatus.set(info.status);
      this.alreadyIn.set((info.playerIds ?? []).includes(this.auth.user()?.id ?? ''));
    } catch {
      // Unknown room: it is created on first join, so just let the player enter
    }
  }

  /** Creates the room when there is none, then joins it with the deck and opens the board. */
  protected async enterWith(deckId: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(deckId);
    this.error.set(null);
    let room = this.roomId();
    try {
      if (!room) room = (await firstValueFrom(this.rooms.create())).roomId;
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo crear la sala'));
      this.busy.set(null);
      return;
    }
    await this.join(room, deckId);
  }

  /** Back to a game in course without choosing a deck again. */
  protected async reconnect(): Promise<void> {
    const room = this.roomId();
    if (!room || this.busy()) return;
    this.busy.set('reconnect');
    this.error.set(null);
    await this.join(room, null);
  }

  private async join(room: string, deckId: string | null): Promise<void> {
    try {
      await this.game.connect(room);
      this.game.joinRoom(deckId);
      await this.router.navigate(['/simulator', room, 'board']);
    } catch {
      this.error.set('No se pudo conectar con el servidor del simulador');
      this.game.disconnect();
    } finally {
      this.busy.set(null);
    }
  }
}
