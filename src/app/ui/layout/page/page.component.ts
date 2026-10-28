import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Standard page frame: title, optional subtitle and actions, then the content.
 * <eras-page title="Ediciones"><button page-actions erasButton>Nueva</button> ... </eras-page>
 */
@Component({
  selector: 'eras-page',
  template: `
    <header class="header">
      <div>
        <h1 class="title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="actions"><ng-content select="[page-actions]" /></div>
    </header>
    <div class="content"><ng-content /></div>
  `,
  styleUrl: './page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"width-" + width()', '[class.fill]': 'fill()' },
})
export class PageComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly width = input<'narrow' | 'default' | 'wide'>('default');
  /** Exactly one screen high (below the header); the content fills the rest instead of scrolling the page. */
  readonly fill = input(false, { transform: booleanAttribute });
}
