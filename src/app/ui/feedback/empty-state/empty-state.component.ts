import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Placeholder for empty lists or loading states; extra content (e.g. a button) is projected. */
@Component({
  selector: 'eras-empty-state',
  // `title` is an input: without this, a static title="…" also stays on the host as the browser's tooltip
  host: { '[attr.title]': 'null' },
  template: `
    <p class="title">{{ title() }}</p>
    @if (description()) {
      <p class="description">{{ description() }}</p>
    }
    <ng-content />
  `,
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
}
