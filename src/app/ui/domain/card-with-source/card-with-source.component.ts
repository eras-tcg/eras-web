import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GameCardComponent } from '../game-card/game-card.component';

/**
 * A card with, small at its lower right corner, the card an effect of it comes from (the Recurso of an inherited
 * effect) or one attached to it (the Material being chosen); `sourceAt="start"` puts it at the lower left. Its size
 * follows `--game-card-width`; `--source-ring` colors the line that sets the small card off (the surface by default).
 * The only small source card: the chain list, effect prompt, log and chain reveal use it.
 *
 * <eras-card-with-source [imageUrl]="card.imageUrl" sourceName="Duregón" [sourceImage]="url" />
 */
@Component({
  selector: 'eras-card-with-source',
  imports: [GameCardComponent],
  template: `
    <eras-game-card [imageUrl]="imageUrl()" [name]="name()" [foil]="foil()" />
    @if (sourceName()) {
      <span class="source" [class.start]="sourceAt() === 'start'" [title]="sourceLabel() ?? 'Heredado de ' + sourceName()">
        <eras-game-card [imageUrl]="sourceImage() ?? null" [name]="sourceName() ?? null" [foil]="sourceFoil()" />
      </span>
    }
  `,
  styles: `
    :host {
      --source-width: calc(var(--game-card-width, 4.5rem) * 0.45);
      position: relative;
      display: block;
      border-radius: var(--radius-card);
    }
    .source {
      --game-card-width: var(--source-width);
      position: absolute;
      inset-block-end: calc(var(--source-width) * -0.12);
      inset-inline-end: calc(var(--source-width) * -0.25);
      display: block;
      border-radius: var(--radius-card);
      box-shadow: 0 0 0 2px var(--source-ring, var(--color-surface)), 0 4px 10px rgb(0 0 0 / 45%);
    }
    .source.start { inset-inline: calc(var(--source-width) * -0.25) auto; }
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
  /** The copies' foil, as their owner has them. */
  readonly foil = input<'foil' | 'prism' | null>(null);
  readonly sourceFoil = input<'foil' | 'prism' | null>(null);
  /** Which lower corner the small card sits at. */
  readonly sourceAt = input<'start' | 'end'>('end');
}
