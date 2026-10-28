import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/** Large cover of an edition with its name over the artwork. Actions go into [featured-actions]. */
@Component({
  selector: 'eras-featured-edition',
  template: `
    <button
      type="button"
      class="cover"
      [style.background-image]="imageUrl() ? 'url(' + imageUrl() + ')' : null"
      [attr.aria-label]="'Ver cartas de ' + (name() ?? code())"
      (click)="selected.emit()"
    >
      <span class="overlay">
        <span class="eyebrow">{{ eyebrow() }}</span>
        <span class="name">{{ name() || code() }}</span>
        @if (description()) {
          <span class="description">{{ description() }}</span>
        }
      </span>
    </button>
    <div class="actions"><ng-content select="[featured-actions]" /></div>
  `,
  styleUrl: './featured-edition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.fill]': 'fill()' },
})
export class FeaturedEditionComponent {
  readonly code = input.required<string>();
  readonly name = input<string | null>(null);
  readonly description = input<string | null>(null);
  readonly imageUrl = input<string | null>(null);
  readonly eyebrow = input('Última edición');

  /** Fill the parent height instead of keeping the 5:7 ratio. */
  readonly fill = input(false, { transform: booleanAttribute });

  readonly selected = output<void>();
}
