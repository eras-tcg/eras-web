import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GameCardComponent } from '../game-card/game-card.component';

/**
 * A card with, small at its lower right corner, the card an effect of it comes from (the Recurso of an inherited
 * effect) or one attached to it (the Material being chosen). Its size follows `--game-card-width`.
 *
 * <eras-card-with-source [imageUrl]="card.imageUrl" sourceName="Duregón" [sourceImage]="url" />
 */
@Component({
  selector: 'eras-card-with-source',
  imports: [GameCardComponent],
  template: `
    <eras-game-card [imageUrl]="imageUrl()" [name]="name()" />
    @if (sourceName()) {
      <span class="source" [title]="sourceLabel() ?? 'Heredado de ' + sourceName()">
        <eras-game-card [imageUrl]="sourceImage() ?? null" [name]="sourceName() ?? null" />
      </span>
    }
  `,
  styles: `
    :host {
      --source-width: calc(var(--game-card-width, 4.5rem) * 0.45);
      position: relative;
      display: block;
    }
    .source {
      --game-card-width: var(--source-width);
      position: absolute;
      inset-block-end: calc(var(--source-width) * -0.12);
      inset-inline-end: calc(var(--source-width) * -0.25);
      display: block;
      border-radius: var(--radius-sm);
      box-shadow: 0 0 0 2px var(--color-surface), 0 4px 10px rgb(0 0 0 / 45%);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardWithSourceComponent {
  readonly imageUrl = input<string | null>(null);
  /** Its name, shown when it has no art (a test card). */
  readonly name = input<string | null>(null);
  /** The card it comes from (none: just the card). */
  readonly sourceName = input<string | null | undefined>(null);
  readonly sourceImage = input<string | null | undefined>(null);
  /** What the small card is, as its tooltip ("Heredado de X" by default; "Material: X"). */
  readonly sourceLabel = input<string | null>(null);
}
