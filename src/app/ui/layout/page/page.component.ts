import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { ScreenBarComponent } from '@core/layout/screen-bar.component';

/**
 * Standard screen frame, game-like: one top row ("back" to the parent screen, the title and the page's actions,
 * the quick buttons), then the content.
 * <eras-page title="Ediciones"><button page-actions erasButton>Nueva</button> ... </eras-page>
 */
@Component({
  selector: 'eras-page',
  imports: [ScreenBarComponent],
  template: `
    <eras-screen-bar class="bar">
      <header class="heading">
        <h1 class="title">{{ title() }}</h1>
      </header>
      <div class="actions"><ng-content select="[page-actions]" /></div>
    </eras-screen-bar>
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
}
