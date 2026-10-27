import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { AuthService } from '../auth/auth.service';
import { ADMIN_TOOLS } from '../navigation/admin-tools';
import { legacyUrl } from '../navigation/legacy-url';
import { MAIN_NAV, NavItem } from '../navigation/nav-items';
import { ThemeService } from '../theme/theme.service';

@Component({
  selector: 'eras-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonComponent, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly nav = MAIN_NAV;
  protected readonly menuOpen = signal(false);
  protected readonly hasAdminTools = computed(() => {
    this.auth.user();
    return ADMIN_TOOLS.some((t) => t.permissions.some((p) => this.auth.can(p)));
  });

  protected href(item: NavItem): string {
    return legacyUrl(item.legacyPath ?? '/');
  }

  protected logout(): void {
    this.auth.logout();
    this.menuOpen.set(false);
    void this.router.navigateByUrl('/');
  }
}
