import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@core/http/api-error';
import { AndroidApp, offersAndroidApp } from '@core/pwa/android-app';
import { detectAppMode } from '@core/pwa/app-mode';
import { DesktopApp, offersDesktopApp } from '@core/pwa/desktop-app';
import { InstallPrompt } from '@core/pwa/install-prompt';
import { ConnectionService } from '@core/server/connection.service';
import { OnlineStatus, isUnreachable } from '@core/server/online-status';
import { ServerWarmupService } from '@core/server/server-warmup.service';
import { GameStore } from '@data/simulator/game.store';
import { OfflineGame } from '@data/simulator/offline-game';
import { RoomsApi } from '@data/simulator/rooms.api';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { HubMenuComponent, HubMenuItem } from './hub-menu.component';
import { HubScreenComponent } from './hub-screen.component';

const PLAY_MENU: HubMenuItem[] = [
  { id: 'online', label: 'Online', icon: 'gamepad', route: '/simulator' },
  { id: 'bot', label: 'Modo solo', icon: 'bot', online: true },
  { id: 'tests', label: 'Sala de pruebas', icon: 'edit', online: true },
  { id: 'tutorial', label: 'Tutorial', icon: 'book', route: '/ruling' },
];

/** Modo solo sin conexión: against the bot with the engine in this browser. */
const OFFLINE_ITEM: HubMenuItem = { id: 'offline', label: 'Modo solo sin conexión', icon: 'wifi-off' };
/** Sala de pruebas without the connection: the engine in this browser, the player on both sides. */
const OFFLINE_TESTS_ITEM: HubMenuItem = { id: 'tests-offline', label: 'Sala de pruebas', icon: 'edit' };
/** Without the server, these play in this browser instead. */
const OFFLINE_SWAP: Record<string, HubMenuItem> = { bot: OFFLINE_ITEM, tests: OFFLINE_TESTS_ITEM };
/** The modes that need the server. */
const NEEDS_SERVER = new Set(['online', 'bot', 'tests']);

/**
 * The Jugar menu: Modo solo and the Sala de pruebas with the server; without it (the installed app not connected,
 * `local`, or the server cut off) the same places play in this browser (Modo solo sin conexión, the Sala de pruebas
 * offline). With no connection at all Online is left out; the installed app not connected keeps it, marked (opening it
 * connects). The tutorial always stays.
 */
export function playMenu(state: { cutOff: boolean; offline: boolean; local?: boolean }): HubMenuItem[] {
  const withServer = !state.cutOff && !state.local;
  return PLAY_MENU.map((item) => (!withServer && OFFLINE_SWAP[item.id]) || item).filter(
    (item) => !(state.cutOff && state.offline && NEEDS_SERVER.has(item.id)),
  );
}

/**
 * "Jugar" screen of the hub: online rooms, Modo solo (against the bot), the Sala de pruebas (a test room), the tutorial,
 * or Modo solo sin conexión (the bot in the browser: first in the list when the server cannot be reached); then, outside
 * the installed app, "Descargar ERAS": the app for this device (the APK on Android, the installer on Windows, otherwise
 * installing the page). Keeping the game for playing offline is in the profile's preferences.
 */
@Component({
  selector: 'eras-play-page',
  imports: [AlertComponent, ButtonComponent, IconComponent, HubMenuComponent, HubScreenComponent],
  template: `
    <eras-hub-screen title="Jugar">
      <eras-hub-menu variant="sub" label="Modos de juego" [items]="menu()" [busy]="busy()" (picked)="start($event.id)" />
      <!-- The app for this device, one button (none in the installed app, nor where nothing can be installed) -->
      @if (getApp(); as kind) {
        <div class="extras">
          <button erasButton variant="float" type="button" (click)="download(kind)">
            <eras-icon name="download" /> Descargar ERAS
          </button>
        </div>
      }
      @if (cutOff()) {
        <eras-alert tone="info">
          @if (offlineNow()) {
            Sin conexión. Puedes jugar contra el bot sin conexión; Online, Modo solo y la Sala de pruebas vuelven con internet.
          } @else {
            Sin conexión con el servidor. Puedes jugar contra el bot sin conexión.
          }
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
    .extras {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-block-start: var(--space-4);
    }
    /* Upright phones (the browser; the game itself is played in landscape): getting the app is what matters here,
       so its buttons go above the menu, full width, instead of below the fold */
    @media (max-width: 63.99rem) and (orientation: portrait) {
      .extras {
        flex-direction: column-reverse;
        order: -1;
      }
      .extras > * {
        justify-content: center;
        inline-size: 100%;
      }
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
  private readonly installer = inject(InstallPrompt);
  private readonly androidApp = inject(AndroidApp);
  private readonly desktopApp = inject(DesktopApp);
  /** What "Descargar ERAS" gives on this device: the APK, the Windows installer, installing the page, or nothing. */
  protected readonly getApp = computed<'android' | 'windows' | 'install' | null>(() => {
    if (detectAppMode() === 'app') return null;
    if (offersAndroidApp({ android: this.androidApp.android, native: false, apk: this.androidApp.apk() })) return 'android';
    if (offersDesktopApp({ windows: this.desktopApp.windows, desktop: false, exe: this.desktopApp.exe() })) return 'windows';
    return this.installer.offer() !== 'none' ? 'install' : null;
  });
  private readonly modal = inject(ModalService);
  private readonly connection = inject(ConnectionService);

  /** The server could not be reached the last time a game was opened. */
  private readonly unreachable = signal(false);
  /** No server to play with: the browser is offline, the server did not answer, or it never woke up. */
  protected readonly cutOff = computed(() => !this.network.online() || this.unreachable() || this.warmup.state() === 'failed');
  protected readonly offlineNow = computed(() => !this.network.online());
  protected readonly menu = computed(() =>
    playMenu({ cutOff: this.cutOff(), offline: this.offlineNow(), local: this.connection.needsConnect() }),
  );
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  /**
   * Modo solo (a room with the server's bot seated), the Sala de pruebas (a test room, both sides played by the player)
   * or Modo solo sin conexión (the engine's room in this browser).
   */
  protected async start(mode: string): Promise<void> {
    if (this.busy() || !['bot', 'tests', 'offline', 'tests-offline'].includes(mode)) return;
    const local = mode === 'offline' || mode === 'tests-offline';
    this.busy.set(mode);
    this.error.set(null);
    try {
      if (local) {
        const roomId = await this.offline.start(mode === 'tests-offline');
        await this.router.navigate(['/simulator', roomId, 'board']);
        return;
      }
      // The installed app connects first (local-first): the warm-up shows while the server wakes up
      const connected = await this.connection.connect('/play');
      if (connected !== 'connected') return;
      const { roomId } = await firstValueFrom(this.rooms.create(mode === 'tests', mode === 'bot'));
      await this.game.connect(roomId);
      this.unreachable.set(false);
      this.game.joinRoom(null);
      await this.router.navigate(['/simulator', roomId, 'board']);
    } catch (e) {
      this.game.disconnect();
      if (local) {
        const what = mode === 'offline' ? 'el modo solo sin conexión' : 'la sala de pruebas sin conexión';
        this.error.set(
          this.offline.ready()
            ? `No se pudo abrir ${what}`
            : `No se pudo cargar ${what}: necesita conexión una vez para descargar el juego (o activa «Guardar el juego para jugar sin conexión» en tu perfil)`,
        );
        return;
      }
      if (isUnreachable(e)) this.unreachable.set(true);
      this.error.set(apiErrorMessage(e, mode === 'bot' ? 'No se pudo abrir el modo solo' : 'No se pudo abrir la sala de pruebas'));
    } finally {
      this.busy.set(null);
    }
  }

  constructor() {
    this.androidApp.lookUp();
    this.desktopApp.lookUp();
  }

  /** "Descargar ERAS": a window saying what it downloads and how (the APK, the installer or the page; each its own chunk). */
  protected async download(kind: 'android' | 'windows' | 'install'): Promise<void> {
    if (kind === 'android') {
      const { AndroidAppDialogComponent } = await import('./android-app-dialog.component');
      this.modal.open(AndroidAppDialogComponent, { data: this.androidApp.apk(), width: '34rem' });
    } else if (kind === 'windows') {
      const { DesktopAppDialogComponent } = await import('./desktop-app-dialog.component');
      this.modal.open(DesktopAppDialogComponent, { data: this.desktopApp.exe(), width: '34rem' });
    } else {
      // What it gives, then the browser's prompt (its own confirmation) or, on iPhone and iPad or on Android without the
      // prompt, how to install it by hand
      const offer = this.installer.offer();
      const { InstallAppDialogComponent } = await import('./install-app-dialog.component');
      this.modal.open(InstallAppDialogComponent, { data: offer === 'prompt' || offer === 'ios' ? offer : 'android', width: '34rem' });
    }
  }
}
