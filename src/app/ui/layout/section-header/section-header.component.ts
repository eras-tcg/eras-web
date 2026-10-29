import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Title of a section inside a page or form, with optional actions on the right. */
@Component({
  selector: 'eras-section-header',
  // `title` is an input: without this, a static title="…" also stays on the host as the browser's tooltip
  host: { '[attr.title]': 'null' },
  template: `
    <h2 class="title">{{ title() }}</h2>
    <div class="actions"><ng-content /></div>
  `,
  styleUrl: './section-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionHeaderComponent {
  readonly title = input.required<string>();
}
