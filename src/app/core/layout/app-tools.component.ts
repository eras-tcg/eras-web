import { CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { AuthService } from '../auth/auth.service';
import { EditModeService } from '../auth/edit-mode.service';
import { ADMIN_TOOLS } from '../navigation/admin-tools';
import { MAIN_NAV } from '../navigation/nav-items';
import { ThemeService } from '../theme/theme.service';

/**
 * Quick controls of the signed-in user: edit-mode switch, theme and the main menu (every section plus the
 * account). Shown in the top bar of every page and on the home hub, which has no bar.
 */
@Component({
  selector: 'eras-app-tools',
  imports: [CdkMenuTrigger, MenuComponent, MenuItemDirective, IconComponent],
  templateUrl: './app-tools.component.html',
  styleUrl: './app-tools.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppToolsComponent {
  protected readonly auth = inject(AuthService);
  protected readonly editMode = inject(EditModeService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly nav = MAIN_NAV;
  protected readonly hasAdminTools = computed(() => {
    this.auth.user();
    return ADMIN_TOOLS.some((t) => t.permissions.some((p) => this.auth.can(p)));
  });

  protected go(url: string): void {
    void this.router.navigateByUrl(url);
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
