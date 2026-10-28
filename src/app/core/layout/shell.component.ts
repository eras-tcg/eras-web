import { CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { AuthService } from '../auth/auth.service';
import { EditModeService } from '../auth/edit-mode.service';
import { ADMIN_TOOLS } from '../navigation/admin-tools';
import { MAIN_NAV } from '../navigation/nav-items';
import { ThemeService } from '../theme/theme.service';

@Component({
  selector: 'eras-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CdkMenuTrigger, MenuComponent, MenuItemDirective, ButtonComponent, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly editMode = inject(EditModeService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly nav = MAIN_NAV;
  protected readonly menuOpen = signal(false);
  protected readonly hasAdminTools = computed(() => {
    this.auth.user();
    return ADMIN_TOOLS.some((t) => t.permissions.some((p) => this.auth.can(p)));
  });
  protected readonly initial = computed(() => (this.auth.user()?.username ?? '?').charAt(0).toUpperCase());

  private readonly navigated = this.router.events.pipe(filter((e) => e instanceof NavigationEnd));

  /** The simulator board uses the whole screen: the navbar gets compact there. */
  protected readonly compact = toSignal(this.navigated.pipe(map(() => /^\/simulator\/[^/]+\/board/.test(this.router.url))), {
    initialValue: false,
  });

  constructor() {
    // Close the mobile menu after any navigation
    this.navigated.subscribe(() => this.menuOpen.set(false));

    // Publish the header height (it changes with the edit-mode banner) for full-screen pages:
    // they size themselves with calc(100dvh - var(--app-header-height)).
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const header = host.nativeElement.querySelector('header');
      if (!header) return;
      const observer = new ResizeObserver(() =>
        document.documentElement.style.setProperty('--app-header-height', header.getBoundingClientRect().height + 'px'),
      );
      observer.observe(header);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected go(url: string): void {
    void this.router.navigateByUrl(url);
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
