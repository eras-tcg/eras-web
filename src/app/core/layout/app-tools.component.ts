import { DOCUMENT, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { AuthService } from '../auth/auth.service';
import { EditModeService } from '../auth/edit-mode.service';
import { ADMIN_PERMISSIONS } from '../navigation/admin-tools';
import { ThemeService } from '../theme/theme.service';
import { ConnectionService } from '../server/connection.service';
import { AppScreen } from '../pwa/app-screen';
import { MISSIONS_DIALOG } from '../missions/missions-dialog';
import { MissionsStore } from '../missions/missions.store';
import { ProgressionStore } from '../missions/progression.store';
import { WalletStore } from '../wallet/wallet.store';

/**
 * Quick buttons at the top right of every screen (icon over a label): the simulated gems (to the shop) and edit mode
 * (administrators only), the missions (their screen on the hub menus, a dialog anywhere else); on the hub screens (`hub`: home, play, social…) also administration (administrators only) and sign out, so the
 * buttons do not change between them;
 * full screen on every screen (with or without a session), only ever followed by sign out (not in the installed app on
 * a phone or tablet: it is always full screen). The installed app has, first, "Conectar" with the state of its
 * connection to the server (local-first: Sin conectar / Conectando… / Conectado / Sin internet); the gems and the
 * missions need the server, and say so until it connects.
 * The sections are reached from the home hub; the theme is in the profile's preferences. Without a session only the theme shows. `onArt`: light text with a shadow, over the hub's artwork.
 */
@Component({
  selector: 'eras-app-tools',
  imports: [DecimalPipe, NgTemplateOutlet, RouterLink, IconComponent],
  templateUrl: './app-tools.component.html',
  styleUrl: './app-tools.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'navigation',
    'aria-label': 'Opciones',
    '[class.on-art]': 'onArt()',
    '(document:fullscreenchange)': 'fullscreen.set(!!document.fullscreenElement)',
  },
})
export class AppToolsComponent {
  protected readonly auth = inject(AuthService);
  protected readonly editMode = inject(EditModeService);
  protected readonly theme = inject(ThemeService);
  protected readonly wallet = inject(WalletStore);
  private readonly missions = inject(MissionsStore);
  private readonly progression = inject(ProgressionStore);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalService);
  private readonly document = inject(DOCUMENT);
  private readonly missionsDialog = inject(MISSIONS_DIALOG, { optional: true });
  protected readonly connection = inject(ConnectionService);
  /** Not in the installed app on a phone or tablet: it is always full screen. */
  protected readonly fullscreenToggle = inject(AppScreen).fullscreenToggle;

  readonly onArt = input(false, { transform: booleanAttribute });
  /** The hub screens: the only ones with administration and sign out. */
  readonly hub = input(false, { transform: booleanAttribute });

  /** Also follows Esc and the board's own full screen button. */
  protected readonly fullscreen = signal(!!this.document.fullscreenElement);

  /** Missions (daily, weekly and progression) whose reward waits to be claimed. */
  protected readonly waiting = computed(() => this.missions.waiting() + this.progression.waiting());

  protected readonly missionsLabel = computed(() =>
    this.connection.needsConnect() ? 'Misiones (necesita conexión)' : this.waiting() ? `Misiones: ${this.waiting()} por reclamar` : 'Misiones',
  );

  protected readonly isAdmin = computed(() => {
    this.auth.user();
    return ADMIN_PERMISSIONS.some((p) => this.auth.can(p));
  });

  /** Edit mode: sets the account's gems to what is typed. */
  protected async editGems(): Promise<void> {
    const typed = await this.modal.prompt({ title: 'Editar gemas', label: 'Gemas de tu cuenta', value: String(this.wallet.gems()), confirmLabel: 'Guardar' });
    const gems = Math.floor(Number(typed));
    if (typed === undefined || !Number.isFinite(gems) || gems < 0) return;
    await this.wallet.setGems(gems);
  }

  /** "Conectar": connects the installed app to the server; "Conectado" disconnects it (nothing to do without internet). */
  protected connect(): void {
    const view = this.connection.view();
    if (view.actionable) void this.connection.connect();
    else if (view.disconnectable) this.connection.disconnect();
  }

  /** Off the hub menus the missions open over the screen, which stays where it was (their screen without the dialog). */
  protected async openMissions(): Promise<void> {
    if ((await this.connection.connect('/missions')) !== 'connected') return;
    if (this.missionsDialog) this.modal.open(await this.missionsDialog());
    else void this.router.navigateByUrl('/missions');
  }

  protected async toggleFullscreen(): Promise<void> {
    try {
      if (this.document.fullscreenElement) await this.document.exitFullscreen();
      else await this.document.documentElement.requestFullscreen();
    } catch {
      // The browser refused it (no user gesture, not allowed): nothing changes
    }
  }

  protected signOut(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
