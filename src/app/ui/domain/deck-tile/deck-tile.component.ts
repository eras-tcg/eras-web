import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CardComponent } from '../../surfaces/card/card.component';

/** Compact deck entry: optional rank, name, author and cover. Actions go into [tile-actions]. */
@Component({
  selector: 'eras-deck-tile',
  imports: [CardComponent],
  template: `
    <eras-card padding="none" [interactive]="!empty()">
      <div class="tile">
        <button type="button" class="open" [disabled]="empty()" (click)="selected.emit()">
          @if (rank() !== null) {
            <span class="rank">#{{ rank() }}</span>
          }
          <span class="info">
            <span class="name">{{ name() || 'Espacio vacío' }}</span>
            @if (author()) {
              <span class="author">{{ author() }}</span>
            }
          </span>
          @if (imageUrl()) {
            <span class="media"><img [src]="imageUrl()" alt="" loading="lazy" /></span>
          }
        </button>
        <div class="actions"><ng-content select="[tile-actions]" /></div>
      </div>
    </eras-card>
  `,
  styleUrl: './deck-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckTileComponent {
  readonly name = input<string | null>(null);
  readonly author = input<string | null>(null);
  readonly imageUrl = input<string | null>(null);
  readonly rank = input<number | null>(null);

  readonly selected = output<void>();

  protected readonly empty = computed(() => !this.name());
}
