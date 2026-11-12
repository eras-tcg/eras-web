import { ChangeDetectionStrategy, Component, booleanAttribute, input, model } from '@angular/core';
import { DECKBOX_COLORS, DeckBoxColor } from '@data/decks/deckbox.model';
import { deckBoxColor } from '@data/decks/deckbox-rules';

const COLOR_NAMES: Record<DeckBoxColor, string> = {
  red: 'Rojo',
  orange: 'Naranja',
  amber: 'Ámbar',
  green: 'Verde',
  teal: 'Turquesa',
  blue: 'Azul',
  violet: 'Violeta',
  pink: 'Rosa',
  slate: 'Gris',
};

/** The deckbox palette as a row of round swatches (a radio group). Two-way `value`; `compact` makes them smaller. */
@Component({
  selector: 'eras-color-swatches',
  template: `
    <div class="swatches" role="radiogroup" aria-label="Color">
      @for (color of colors; track color) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="value() === color"
          [attr.aria-label]="names[color]"
          [title]="names[color]"
          [class.on]="value() === color"
          [style.background]="css(color)"
          (click)="value.set(color)"
        ></button>
      }
    </div>
  `,
  styles: `
    .swatches { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    button {
      inline-size: 1.5rem;
      block-size: 1.5rem;
      padding: 0;
      border: 2px solid transparent;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: inset 0 0 0 2px var(--color-surface);
    }
    button.on { border-color: var(--color-text); }
    button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }
    :host(.compact) button { inline-size: 1.15rem; block-size: 1.15rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.compact]': 'compact()' },
})
export class ColorSwatchesComponent {
  readonly value = model.required<DeckBoxColor>();
  readonly compact = input(false, { transform: booleanAttribute });
  protected readonly colors = DECKBOX_COLORS;
  protected readonly names = COLOR_NAMES;
  protected readonly css = (color: DeckBoxColor) => deckBoxColor({ color });
}
