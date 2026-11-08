import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@core/http/api-error';
import { OnlineStatus, isUnreachable } from '@core/server/online-status';
import { ServerWarmupService } from '@core/server/server-warmup.service';
import { GameStore } from '@data/simulator/game.store';
import { OfflineGame } from '@data/simulator/offline-game';
import { RoomsApi } from '@data/simulator/rooms.api';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { HubMenuComponent, HubMenuItem } from './hub-menu.component';
import { HubScreenComponent } from './hub-screen.component';

const PLAY_MENU: HubMenuItem[] = [
  { id: 'online', label: 'Online', icon: 'gamepad', route: '/simulator' },
  { id: 'bot', label: 'Modo solo', icon: 'bot' },
  { id: 'tests', label: 'Sala de pruebas', icon: 'edit' },
  { id: 'tutorial', label: 'Tutorial', icon: 'book', route: '/ruling' },
];

/** Modo solo sin conexión: against the bot with the engine in this browser. */
const OFFLINE_ITEM: HubMenuItem = { id: 'offline', label: 'Modo solo sin conexión', icon: 'wifi-off' };

/**
 * "Jugar" screen of the hub: online rooms, Modo solo (against the bot), the Sala de pruebas (a test room), the tutorial,
 * or Modo solo sin conexión (the bot in the browser: first in the list when the server cannot be reached).
 */
@Component({
  selector: 'eras-play-page',
  imports: [AlertComponent, ButtonComponent, HubMenuComponent, HubScreenComponent],
  template: `
    <eras-hub-screen title="Jugar">
      <eras-hub-menu variant="sub" label="Modos de juego" [items]="menu()" [busy]="busy()" (picked)="start($event.id)" />
      @if (cutOff()) {
        <eras-alert tone="info">
          Sin conexión con el servidor. Puedes jugar contra el bot sin conexión.
          <button erasButton size="sm" type="button" [disabled]="!!busy()" (click)="start('offline')">Jugar sin conexión</button>
        </eras-alert>
      }
      @if (error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
    </eras-hub-screen>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-block-size: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayPage {
  private readonly rooms = inject(RoomsApi);
  private readonly game = inject(GameStore);
  private readonly offline = inject(OfflineGame);
  private readonly router = inject(Router);
  private readonly network = inject(OnlineStatus);
  private readonly warmup = inject(ServerWarmupService);

  /** The server could not be reached the last time a game was opened. */
  private readonly unreachable = signal(false);
  /** No server to play with: the browser is offline, the server did not answer, or it never woke up. */
  protected readonly cutOff = computed(() => !this.network.online() || this.unreachable() || this.warmup.state() === 'failed');
  protected readonly menu = computed(() => (this.cutOff() ? [OFFLINE_ITEM, ...PLAY_MENU] : [...PLAY_MENU, OFFLINE_ITEM]));
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  /**
   * Modo solo (a room with the server's bot seated), the Sala de pruebas (a test room, both sides played by the player)
   * or Modo solo sin conexión (the engine's room in this browser).
   */
  protected async start(mode: string): Promise<void> {
    if (this.busy() || (mode !== 'bot' && mode !== 'tests' && mode !== 'offline')) return;
    this.busy.set(mode);
    this.error.set(null);
    try {
      if (mode === 'offline') {
        const roomId = await this.offline.start();
        await this.router.navigate(['/simulator', roomId, 'board']);
        return;
      }
      const { roomId } = await firstValueFrom(this.rooms.create(mode === 'tests', mode === 'bot'));
      await this.game.connect(roomId);
      this.unreachable.set(false);
      this.game.joinRoom(null);
      await this.router.navigate(['/simulator', roomId, 'board']);
    } catch (e) {
      this.game.disconnect();
      if (mode === 'offline') {
        this.error.set(
          this.offline.ready()
            ? 'No se pudo abrir el modo solo sin conexión'
            : 'No se pudo cargar el modo solo sin conexión: la primera vez en cada visita necesita conexión para descargar el juego',
        );
        return;
      }
      if (isUnreachable(e)) this.unreachable.set(true);
      this.error.set(apiErrorMessage(e, mode === 'bot' ? 'No se pudo abrir el modo solo' : 'No se pudo abrir la sala de pruebas'));
    } finally {
      this.busy.set(null);
    }
  }
}
