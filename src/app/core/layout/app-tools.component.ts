import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { AuthService } from '../auth/auth.service';
import { EditModeService } from '../auth/edit-mode.service';
import { ADMIN_PERMISSIONS } from '../navigation/admin-tools';
import { ThemeService } from '../theme/theme.service';
import { MissionsStore } from '../missions/missions.store';
import { WalletStore } from '../wallet/wallet.store';

/**
 * Quick buttons at the top right of every screen (icon over a label): the simulated gems (to the shop) and edit mode
 * (administrators only); on the home's main menu (`home`) also administration (administrators only) and sign out.
 * The sections are reached from the home hub; the theme is in the profile's preferences. Without a session only the theme shows. `onArt`: light text with a shadow, over the hub's artwork.
 */
@Component({
  selector: 'eras-app-tools',
  imports: [DecimalPipe, RouterLink, IconComponent],
  templateUrl: './app-tools.component.html',
  styleUrl: './app-tools.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'navigation', 'aria-label': 'Opciones', '[class.on-art]': 'onArt()' },
})
export class AppToolsComponent {
  protected readonly auth = inject(AuthService);
  protected readonly editMode = inject(EditModeService);
  protected readonly theme = inject(ThemeService);
  protected readonly wallet = inject(WalletStore);
  protected readonly missions = inject(MissionsStore);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalService);

  readonly onArt = input(false, { transform: booleanAttribute });
  /** The home's main menu: the only screen with administration and sign out. */
  readonly home = input(false, { transform: booleanAttribute });

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

  protected signOut(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
