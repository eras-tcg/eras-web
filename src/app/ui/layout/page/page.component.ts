import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { ScreenBarComponent } from '@core/layout/screen-bar.component';
import { ScreenLink } from '@core/navigation/screens';

/**
 * Standard screen frame, game-like: one top row ("back" to the parent screen, the title and the page's actions,
 * the quick buttons), then the content. `immersive` hides that row for a moment (an opening that takes the screen).
 * <eras-page title="Ediciones"><button page-actions erasButton>Nueva</button> ... </eras-page>
 */
@Component({
  selector: 'eras-page',
  imports: [ScreenBarComponent],
  template: `
    <!-- Immersive: no top row at all, only the content (it keeps the title for screen readers) -->
    @if (immersive()) {
      <h1 class="sr-only">{{ title() }}</h1>
    } @else {
      <eras-screen-bar class="bar" [back]="back()">
        <header class="heading">
          <h1 class="title">{{ title() }}</h1>
        </header>
        <div class="actions"><ng-content select="[page-actions]" /></div>
      </eras-screen-bar>
    }
    <div class="content"><ng-content /></div>
  `,
  styleUrl: './page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `title` is an input: without this, a static title="…" also stays on the host as the browser's tooltip
  host: { '[attr.title]': 'null', '[class]': '"width-" + width()', '[class.fill]': 'fill()' },
})
export class PageComponent {
  readonly title = input.required<string>();
  readonly width = input<'narrow' | 'default' | 'wide'>('default');
  /** Exactly one screen high (below the header); the content fills the rest instead of scrolling the page. */
  readonly fill = input(false, { transform: booleanAttribute });
  /** Without the top row: the content alone takes the screen. */
  readonly immersive = input(false, { transform: booleanAttribute });
  /** Where "back" leads, when not the screen tree's parent (see screens.ts). */
  readonly back = input<ScreenLink>();
}
