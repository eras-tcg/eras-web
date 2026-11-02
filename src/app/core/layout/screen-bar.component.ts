import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { parentScreen } from '../navigation/screens';
import { AppToolsComponent } from './app-tools.component';

/**
 * Top row of a screen, in place of a navigation bar: "back" to the screen it hangs from (see screens.ts), the
 * projected heading in the middle and the quick buttons. Every page has it through <eras-page>.
 */
@Component({
  selector: 'eras-screen-bar',
  imports: [RouterLink, IconComponent, AppToolsComponent],
  template: `
    @if (parent; as back) {
      <a class="back" [routerLink]="back.route" [attr.aria-label]="'Volver a ' + back.label" [attr.title]="'Volver a ' + back.label">
        <eras-icon name="chevron-left" />
      </a>
    }
    <div class="middle"><ng-content /></div>
    <eras-app-tools class="tools" />
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .back {
      display: grid;
      flex-shrink: 0;
      place-items: center;
      inline-size: 2.5rem;
      block-size: 2.5rem;
      border: var(--border-width) solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text-muted);
      transition:
        color var(--duration-fast) var(--easing-standard),
        border-color var(--duration-fast) var(--easing-standard),
        transform var(--duration-fast) var(--easing-standard);
    }
    .back eras-icon {
      inline-size: 1.2rem;
      block-size: 1.2rem;
    }
    .back:hover {
      border-color: var(--color-hub-accent);
      color: var(--color-text);
      transform: translateX(-2px);
    }
    .middle {
      display: flex;
      flex: 1;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3) var(--space-4);
      min-inline-size: 0;
    }
    .tools {
      flex-shrink: 0;
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
