import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { IconComponent } from '@ui/primitives/icon/icon.component';

export type PickCardTone = 'success' | 'danger';

/**
 * A card to choose in a list (a choice, a pile, the mulligan): styles a native `<button>` around the projected card.
 * Chosen: the success frame and a check over the card's middle (or `mark`, e.g. the link it takes in the chain);
 * numbered (`order`): the primary frame and its number. `tone="danger"`: chosen to be sent away (frame only, no mark).
 * The card's width is the parent's (`--game-card-width` on the button). Hold-to-peek stays beside it, in the caller.
 *
 * <button erasPickCard type="button" [chosen]="isChosen" (click)="toggle()"><eras-game-card … /></button>
 */
@Component({
  selector: 'button[erasPickCard]',
  imports: [IconComponent],
  template: `
    <ng-content />
    @if (chosen() && tone() === 'success') {
      <span class="mark">
        @if (mark(); as n) {
          {{ n }}
        } @else {
          <eras-icon name="check" />
        }
      </span>
    } @else if (numbered()) {
      <span class="mark order">{{ order() }}</span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1);
      border: 2px solid transparent;
      border-radius: var(--radius-md);
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    :host(:hover:not(:disabled, .view-only, .chosen, .numbered)) { border-color: color-mix(in srgb, var(--color-primary) 60%, transparent); }
    :host(:focus-visible) { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    :host(.chosen) { border-color: var(--color-success); background: color-mix(in srgb, var(--color-success) 12%, transparent); }
    :host(.chosen.danger) { border-color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 12%, transparent); }
    :host(.numbered) { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, transparent); }
    :host(.dimmed) { opacity: 0.4; }
    :host(:disabled) { cursor: not-allowed; }
    // A disabled button swallows the mouse: the card can still be held to see it in detail (the peek is beside it)
    :host(:disabled) { pointer-events: none; }
    :host(.view-only), :host(.view-only:disabled) { opacity: 1; cursor: default; }
    // Over the card's middle: a check (or the link it takes), or its number in an order
    .mark {
      position: absolute;
      inset-block-start: 45%;
      inset-inline-start: 50%;
      display: grid;
      place-items: center;
      inline-size: 2rem;
      block-size: 2rem;
      border: 2px solid var(--color-on-success);
      border-radius: 50%;
      background: var(--color-success);
      box-shadow: var(--shadow-md);
      color: var(--color-on-success);
      font: 700 1rem/1 var(--font-family-display);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .mark eras-icon { inline-size: 1.2rem; block-size: 1.2rem; }
    // The number in the theme's text color over its primary color (white on a light primary could not be read)
    .mark.order { border-color: var(--color-on-primary); background: var(--color-primary); color: var(--color-on-primary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.chosen]': 'chosen()',
    '[class.danger]': 'tone() === "danger"',
    '[class.numbered]': 'numbered()',
    '[class.dimmed]': 'dimmed()',
    '[class.view-only]': 'viewOnly()',
    '[attr.aria-pressed]': 'viewOnly() ? null : chosen() || numbered()',
  },
})
export class PickCardComponent {
  readonly chosen = input(false, { transform: booleanAttribute });
  /** What the chosen mark says instead of the check (the link number in a chain). */
  readonly mark = input<number | string | null>(null);
  /** Its number in an order being given (1, 2…); 0 or null: none. Shown while not chosen. */
  readonly order = input<number | null>(null);
  /** Does not meet the effect, or cannot be added now: faded. */
  readonly dimmed = input(false, { transform: booleanAttribute });
  /** Only shown (a yes/no about it): no hover nor pressed state. */
  readonly viewOnly = input(false, { transform: booleanAttribute });
  readonly tone = input<PickCardTone>('success');

  protected readonly numbered = computed(() => !this.chosen() && (this.order() ?? 0) > 0);
}
