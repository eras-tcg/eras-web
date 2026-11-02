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
  {
    id: 'online',
    label: 'Online',
    icon: 'gamepad',
    route: '/simulator',
    description: 'Crea una sala o únete a una de las salas abiertas.',
  },
  {
    id: 'solo',
    label: 'Modo solo',
    icon: 'user',
    description: 'Juega los dos lados de una partida libre, con acciones manuales y cartas de prueba.',
  },
  {
    id: 'tutorial',
    label: 'Tutorial',
    icon: 'book',
    route: '/ruling',
    description: 'Aprende las reglas paso a paso.',
    tag: 'Pronto: partidas guiadas',
  },
];

/** "Jugar" screen of the hub: online rooms, solo mode (a test room) or the tutorial. */
@Component({
  selector: 'eras-play-page',
  imports: [AlertComponent, HubMenuComponent, HubScreenComponent],
  template: `
    <eras-hub-screen title="Jugar">
      <eras-hub-menu variant="sub" label="Modos de juego" [items]="menu" [busy]="busy()" (picked)="startSolo()" />
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

  /** Solo mode: a test room, where the player controls both sides. */
  protected async startSolo(): Promise<void> {
    if (this.busy()) return;
    this.busy.set('solo');
    this.error.set(null);
    try {
      const { roomId } = await firstValueFrom(this.rooms.create(true));
      await this.game.connect(roomId);
      this.game.joinRoom(null);
      await this.router.navigate(['/simulator', roomId, 'board']);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo abrir la partida en modo solo'));
      this.game.disconnect();
    } finally {
      this.busy.set(null);
    }
  }
}
