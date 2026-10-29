import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { EditModeService } from '@core/auth/edit-mode.service';
import { apiErrorMessage } from '@core/http/api-error';
import { GameStore } from '@data/simulator/game.store';
import { RoomsApi } from '@data/simulator/rooms.api';
import { RoomInfo, STATUS_LABELS } from '@data/simulator/simulator.model';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';

/**
 * Simulator entrance: create a room or join an open one (listed, all public) or one by its code. A shared
 * link (/simulator/:roomId) joins that room directly after checking it exists (if not, it offers to create one). Decks, starters and who goes first are chosen inside the room,
 * in its pre-room, so changing them never leaves the room.
 */
@Component({
  selector: 'eras-lobby-page',
  imports: [PageComponent, StackComponent, SectionHeaderComponent, FormFieldComponent, AlertComponent, EmptyStateComponent, ButtonComponent, SpinnerComponent, CardComponent],
  templateUrl: './lobby.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyPage {
  /** Route param of /simulator/:roomId (a shared link). */
  readonly roomId = input<string>();

  private readonly auth = inject(AuthService);
  private readonly rooms = inject(RoomsApi);
  protected readonly game = inject(GameStore);
  private readonly router = inject(Router);
  /** In the site's edit mode a test room can be made: played alone on both sides. */
  protected readonly editMode = inject(EditModeService);

  protected readonly labels = STATUS_LABELS;
  /** What is being done: 'create', a room id being joined, or null. */
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  /** The code typed (or taken from the link). */
  protected readonly code = signal('');
  /** The room asked for does not exist: offer to create one or change the code. */
  protected readonly missing = signal<string | null>(null);
  protected readonly list = signal<RoomInfo[] | null>(null);
  private readonly me = computed(() => this.auth.user()?.id ?? '');

  constructor() {
    void this.refresh();
    // A shared link (/simulator/:roomId) joins that room right away, once it is known to exist
    effect(() => {
      const room = this.roomId()?.trim();
      if (!this.me()) return;
      untracked(() => {
        this.code.set(room ?? '');
        this.missing.set(null);
        if (room) void this.join(room);
      });
    });
  }

  protected async refresh(): Promise<void> {
    try {
      this.list.set(await firstValueFrom(this.rooms.list()));
    } catch {
      this.list.set([]);
    }
  }

  /** I am already in it: going back to it is always possible. */
  protected isMine(room: RoomInfo): boolean {
    return (room.playerIds ?? []).includes(this.me());
  }

  protected canJoin(room: RoomInfo): boolean {
    return this.isMine(room) || (room.playerCount ?? 0) < 2;
  }

  protected async create(editor = false): Promise<void> {
    if (this.busy()) return;
    this.busy.set(editor ? 'test' : 'create');
    this.error.set(null);
    try {
      const { roomId } = await firstValueFrom(this.rooms.create(editor));
      await this.enter(roomId);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo crear la sala'));
      this.busy.set(null);
    }
  }

  /** Joins a room after checking it exists and has room for me. */
  protected async join(id: string): Promise<void> {
    const room = id.trim();
    if (!room || this.busy()) return;
    this.busy.set(room);
    this.error.set(null);
    this.missing.set(null);
    let info: RoomInfo;
    try {
      info = await firstValueFrom(this.rooms.get(room));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) this.missing.set(room);
      else this.error.set(apiErrorMessage(e, 'No se pudo revisar la sala'));
      this.busy.set(null);
      return;
    }
    if (!this.canJoin(info)) {
      this.error.set(`La sala ${room} ya tiene dos jugadores`);
      this.busy.set(null);
      return;
    }
    await this.enter(room);
  }

  private async enter(room: string): Promise<void> {
    try {
      await this.game.connect(room);
      this.game.joinRoom(null);
      // From a link the lobby is left out of the history, so going back does not join again
      await this.router.navigate(['/simulator', room, 'board'], { replaceUrl: !!this.roomId() });
    } catch {
      this.error.set('No se pudo conectar con el servidor del simulador');
      this.game.disconnect();
    } finally {
      this.busy.set(null);
    }
  }

  protected playersOf(room: RoomInfo): string {
    const names = room.players ?? [];
    return names.length ? names.join(' vs ') : 'Sin jugadores';
  }
}
