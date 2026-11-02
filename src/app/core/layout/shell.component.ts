import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { AuthService } from '../auth/auth.service';
import { EditModeService } from '../auth/edit-mode.service';
import { VersionService } from '../version/version.service';
import { AppToolsComponent } from './app-tools.component';

/**
 * App frame. There is no navigation bar: the home hub is the menu and every screen draws its own top strip
 * ("back" and the quick buttons, see <eras-screen-bar>). The header only carries the banners.
 */
@Component({
  selector: 'eras-shell',
  imports: [RouterOutlet, IconComponent, AppToolsComponent],
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

  /** The hub screens (home, Jugar, Social): they fit the window exactly. */
  protected readonly hub = computed(() => /^\/(?:home|play|social)(?:[?#]|$)/.test(this.url()));

  constructor() {
    // The hub screens fit the window: the page neither scrolls nor bounces (rubber-band) there
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
