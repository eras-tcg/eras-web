import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { GameStore } from '@data/simulator/game.store';
import { RoomsApi } from '@data/simulator/rooms.api';
import { RoomInfo, STATUS_LABELS } from '@data/simulator/simulator.model';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconButtonComponent } from '@ui/primitives/icon-button/icon-button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { HubMenuComponent, HubMenuItem } from '../home/hub-menu.component';
import { HubScreenComponent } from '../home/hub-screen.component';

const LOBBY_ACTIONS: HubMenuItem[] = [
  { id: 'create', label: 'Crear sala', icon: 'plus' },
  { id: 'solo', label: 'Modo solo', icon: 'user' },
];

/**
 * Simulator entrance (Online, in the hub's frame like Jugar): create a room or join an open one (listed, all public) or one by its code. A shared
 * link (/simulator/:roomId) joins that room directly after checking it exists (if not, it offers to create one). Decks, starters and who goes first are chosen inside the room,
 * in its pre-room, so changing them never leaves the room.
 */
@Component({
  selector: 'eras-lobby-page',
  imports: [HubScreenComponent, HubMenuComponent, AlertComponent, ButtonComponent, IconButtonComponent, IconComponent, SpinnerComponent],
  templateUrl: './lobby.page.html',
  styleUrl: './lobby.page.scss',
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

  protected readonly labels = STATUS_LABELS;
  protected readonly actions = LOBBY_ACTIONS;
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

  /** "Crear sala" or "Modo solo" from the menu. */
  protected pick(item: HubMenuItem): void {
    void this.create(item.id === 'solo');
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
