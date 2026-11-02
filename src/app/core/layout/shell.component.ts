import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { AuthService } from '../auth/auth.service';
import { EditModeService } from '../auth/edit-mode.service';
import { VersionService } from '../version/version.service';
import { AppToolsComponent } from './app-tools.component';

/**
 * App frame. There is no navigation bar: the home hub is the menu, and every other page has a slim bar with
 * "back to home" and the quick tools (sections menu, theme, edit mode).
 */
@Component({
  selector: 'eras-shell',
  imports: [RouterOutlet, RouterLink, IconComponent, AppToolsComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly editMode = inject(EditModeService);
  private readonly router = inject(Router);
  protected readonly version = inject(VersionService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: '' },
  );

  /** The simulator board uses the whole screen: the bar gets compact there. */
  protected readonly compact = computed(() => /^\/simulator\/[^/]+\/board/.test(this.url()));
  /** The hub screens (home, Jugar, Social) draw their own top row. */
  protected readonly hub = computed(() => /^\/(?:home|play|social)(?:[?#]|$)/.test(this.url()));

  constructor() {
    // Publish the header height (it changes with the banners) for full-screen pages:
    // they size themselves with calc(100dvh - var(--app-header-height)).
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.version.start();
      const header = host.nativeElement.querySelector('header');
      if (!header) return;
      const observer = new ResizeObserver(() =>
        document.documentElement.style.setProperty('--app-header-height', header.getBoundingClientRect().height + 'px'),
      );
      observer.observe(header);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
