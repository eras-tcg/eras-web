import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { AuthService } from '../auth/auth.service';
import { OnlineStatus } from '../server/online-status';
import { VersionService, inGame, versionBanner } from '../version/version.service';
import { AppToolsComponent } from './app-tools.component';
import { LoadingScreenComponent } from './loading-screen.component';

/**
 * App frame. There is no navigation bar: the home hub is the menu and every screen draws its own top strip
 * ("back" and the quick buttons, see <eras-screen-bar>). The header only carries the banners.
 */
@Component({
  selector: 'eras-shell',
  imports: [RouterOutlet, RouterLink, IconComponent, AppToolsComponent, LoadingScreenComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly version = inject(VersionService);
  private readonly network = inject(OnlineStatus);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: '' },
  );

  /** A new version (never over a game's table) or a broken one (VersionService). */
  protected readonly versionBanner = computed(() =>
    versionBanner({
      updateAvailable: this.version.updateAvailable(),
      broken: this.version.broken(),
      url: this.url(),
      appUpdate: !!this.version.appUpdate(),
    }),
  );

  /**
   * No connection: said once at the top, with the way to Modo solo sin conexión; not on "Jugar" (it says it there),
   * the login (idem) or a game's table.
   */
  protected readonly offlineBanner = computed(() => {
    const url = this.url();
    return !this.network.online() && !!url && !inGame(url) && !/^\/(?:play|login)(?:[/?#]|$)/.test(url);
  });

  /** The hub screens (home, Jugar, Social): they fit the window exactly. */
  protected readonly hub = computed(() => /^\/(?:home|play|social)(?:[?#]|$)/.test(this.url()));

  constructor() {
    // A new version is taken by itself on a safe screen (never over a game, the deck builder or a form)
    effect(() => {
      const url = this.url();
      if (this.version.updateAvailable() || this.version.broken()) void this.version.applyWhenSafe(url);
    });

    // The hub screens fit the window: the page does not scroll there
    const body = inject(DOCUMENT).body;
    effect(() => body.classList.toggle('eras-hub', this.hub()));

    // Publish the header height (it changes with the banners) for full-screen pages:
    // they size themselves with calc(100dvh - var(--app-header-height)).
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.version.start();
      const header = host.nativeElement.querySelector('header');
      if (!header) return;
      // Published right away too: a header that never shows (no banner) is never reported by the observer
      const publish = () => document.documentElement.style.setProperty('--app-header-height', header.getBoundingClientRect().height + 'px');
      publish();
      const observer = new ResizeObserver(publish);
      observer.observe(header);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
