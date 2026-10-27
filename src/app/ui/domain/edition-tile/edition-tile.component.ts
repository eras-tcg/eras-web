import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CardComponent } from '../../surfaces/card/card.component';

/**
 * Presentational tile of an edition. Knows nothing about the API: the page
 * passes plain values and projects action buttons into [tile-actions].
 */
@Component({
  selector: 'eras-edition-tile',
  imports: [CardComponent],
  templateUrl: './edition-tile.component.html',
  styleUrl: './edition-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionTileComponent {
  readonly code = input.required<string>();
  readonly name = input<string | null>(null);
  readonly cardCount = input<number | null>(null);
  readonly description = input<string | null>(null);
  readonly imageUrl = input<string | null>(null);

  readonly selected = output<void>();
}
