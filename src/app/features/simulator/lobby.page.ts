import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { DecksStore } from '@data/decks/decks.store';
import { GameStore } from '@data/simulator/game.store';
import { RoomsApi } from '@data/simulator/rooms.api';
import { RoomStatus, STATUS_LABELS } from '@data/simulator/simulator.model';
import { DeckCardComponent } from '@ui/domain/deck-card/deck-card.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';

/** Simulator lobby: create a room or open a shared one, pick a deck and enter (or reconnect). */
@Component({
  selector: 'eras-lobby-page',
  imports: [PageComponent, CardComponent, StackComponent, GridComponent, SectionHeaderComponent, DeckCardComponent, AlertComponent, EmptyStateComponent, ButtonComponent, SpinnerComponent],
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

  protected readonly selected = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly roomStatus = signal<RoomStatus | null>(null);
  protected readonly alreadyIn = signal(false);
  protected readonly checking = signal(false);

  /** Own decks first, then public ones not already listed. */
  protected readonly allDecks = computed(() => {
    const mine = this.decks.myDecks();
    const ids = new Set(mine.map((d) => d.id));
    return [...mine, ...this.decks.publicDecks().filter((d) => !ids.has(d.id))];
  });
  protected readonly statusLabel = computed(() => (this.roomStatus() ? STATUS_LABELS[this.roomStatus()!] : ''));
  protected readonly link = computed(() => (this.roomId() ? `${location.origin}/simulator/${this.roomId()}` : ''));

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
    this.checking.set(true);
    try {
      const info = await firstValueFrom(this.rooms.get(room));
      this.roomStatus.set(info.status);
      this.alreadyIn.set((info.playerIds ?? []).includes(this.auth.user()?.id ?? ''));
    } catch {
      // Unknown room: it is created on first join, so just let the player enter
    } finally {
      this.checking.set(false);
    }
  }

  protected async create(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const { roomId } = await firstValueFrom(this.rooms.create());
      await this.router.navigate(['/simulator', roomId], { replaceUrl: true });
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo crear la sala'));
    } finally {
      this.busy.set(false);
    }
  }

  /** Enters with the selected deck, or with none to reconnect to a game already in course. */
  protected async enter(withDeck: boolean): Promise<void> {
    const room = this.roomId();
    if (!room) return;
    if (withDeck && !this.selected()) {
      this.error.set('Elige un mazo primero');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.game.connect(room);
      this.game.joinRoom(withDeck ? this.selected() : null);
      await this.router.navigate(['/simulator', room, 'board']);
    } catch {
      this.error.set('No se pudo conectar con el servidor del simulador');
      this.game.disconnect();
    } finally {
      this.busy.set(false);
    }
  }

  protected async copy(): Promise<void> {
    await navigator.clipboard?.writeText(this.link()).catch(() => undefined);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
