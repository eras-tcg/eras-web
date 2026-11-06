import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@core/http/api-error';
import { GameStore } from '@data/simulator/game.store';
import { RoomsApi } from '@data/simulator/rooms.api';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { HubMenuComponent, HubMenuItem } from './hub-menu.component';
import { HubScreenComponent } from './hub-screen.component';

const PLAY_MENU: HubMenuItem[] = [
  { id: 'online', label: 'Online', icon: 'gamepad', route: '/simulator' },
  { id: 'bot', label: 'Modo solo', icon: 'bot' },
  { id: 'tests', label: 'Sala de pruebas', icon: 'edit' },
  { id: 'tutorial', label: 'Tutorial', icon: 'book', route: '/ruling' },
];

/** "Jugar" screen of the hub: online rooms, Modo solo (against the bot), the Sala de pruebas (a test room) or the tutorial. */
@Component({
  selector: 'eras-play-page',
  imports: [AlertComponent, HubMenuComponent, HubScreenComponent],
  template: `
    <eras-hub-screen title="Jugar">
      <eras-hub-menu variant="sub" label="Modos de juego" [items]="menu" [busy]="busy()" (picked)="start($event.id)" />
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
  private readonly router = inject(Router);

  protected readonly menu = PLAY_MENU;
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  /** Modo solo (a room with the server's bot seated), or the Sala de pruebas (a test room, both sides played by the player). */
  protected async start(mode: string): Promise<void> {
    if (this.busy() || (mode !== 'bot' && mode !== 'tests')) return;
    this.busy.set(mode);
    this.error.set(null);
    try {
      const { roomId } = await firstValueFrom(this.rooms.create(mode === 'tests', mode === 'bot'));
      await this.game.connect(roomId);
      this.game.joinRoom(null);
      await this.router.navigate(['/simulator', roomId, 'board']);
    } catch (e) {
      this.error.set(apiErrorMessage(e, mode === 'bot' ? 'No se pudo abrir el modo solo' : 'No se pudo abrir la sala de pruebas'));
      this.game.disconnect();
    } finally {
      this.busy.set(null);
    }
  }
}
