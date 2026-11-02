import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { AuthService } from '../auth/auth.service';
import { EditModeService } from '../auth/edit-mode.service';
import { ADMIN_TOOLS } from '../navigation/admin-tools';
import { ThemeService } from '../theme/theme.service';
import { WalletStore } from '../wallet/wallet.store';

/**
 * Quick buttons at the top right of every screen (icon over a label): the simulated gems (to the shop), edit mode,
 * administration and sign out. The sections are reached from the home hub; the theme is in the profile's
 * preferences. Without a session only the theme shows. `onArt`: light text with a shadow, over the hub's artwork.
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
  private readonly router = inject(Router);

  readonly onArt = input(false, { transform: booleanAttribute });

  protected readonly hasAdminTools = computed(() => {
    this.auth.user();
    return ADMIN_TOOLS.some((t) => t.permissions.some((p) => this.auth.can(p)));
  });

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
