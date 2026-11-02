import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { parentScreen } from '../navigation/screens';
import { AppToolsComponent } from './app-tools.component';

/**
 * Top strip of a screen, in place of a navigation bar: "back" to the screen it hangs from (see screens.ts) and
 * the quick buttons. Every page has it through <eras-page>; full-screen tools add it themselves.
 */
@Component({
  selector: 'eras-screen-bar',
  imports: [RouterLink, IconComponent, AppToolsComponent],
  template: `
    @if (parent; as back) {
      <a class="back" [routerLink]="back.route" [attr.aria-label]="'Volver a ' + back.label">
        <span class="ring" aria-hidden="true"><eras-icon name="chevron-left" /></span>
        <span class="label">{{ back.label }}</span>
      </a>
    }
    <eras-app-tools class="tools" />
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.08em;
      text-decoration: none;
      text-transform: uppercase;
      transition: color var(--duration-fast) var(--easing-standard);
    }
    .ring {
      display: grid;
      place-items: center;
      inline-size: 2.25rem;
      block-size: 2.25rem;
      border: var(--border-width) solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      transition:
        border-color var(--duration-fast) var(--easing-standard),
        transform var(--duration-fast) var(--easing-standard);
    }
    .ring eras-icon {
      inline-size: 1.1rem;
      block-size: 1.1rem;
    }
    .back:hover {
      color: var(--color-text);
    }
    .back:hover .ring {
      border-color: var(--color-hub-accent);
      transform: translateX(-2px);
    }
    .tools {
      margin-inline-start: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScreenBarComponent {
  // The page's own route (the bar lives inside it): a page is recreated for each screen, so reading it once is enough
  protected readonly parent = parentScreen(
    '/' +
      inject(ActivatedRoute)
        .snapshot.pathFromRoot.flatMap((r) => r.url.map((s) => s.path))
        .filter(Boolean)
        .join('/'),
  );
}
