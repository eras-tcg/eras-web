import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** A rarity's color in the shop's palette (no rarity: the border's). */
export function rarityColor(rarity: string | null | undefined): string {
  return rarity ? `var(--color-rarity-${rarity.toLowerCase()})` : 'var(--color-border)';
}

/**
 * A card's rarity on a tab over its top edge, in the shop's rarity colors (on a `span`, or a `button` when it can be
 * changed). It is flush with the card's right edge, square at its top-right corner, coming down behind the card past
 * its rounded corner with its label above the card; the left side cut on a slant. `over`: on the card itself, inside its corner.
 *
 * The parent is positioned and leaves room above the card (`margin-block-start: var(--rarity-tab-height)`, 1.5rem by
 * default); the card itself is positioned with `z-index: 1`, so the tab's lower part hides under it. Smaller: `--rarity-tab-height`,
 * `--rarity-tab-font`, `--rarity-tab-min` (width) and `--rarity-tab-slant` on a parent.
 */
@Component({
  selector: 'span[erasRarityTab], button[erasRarityTab]',
  template: `{{ erasRarityTab() || '—' }}`,
  host: {
    '[attr.data-rarity]': 'erasRarityTab() || null',
    '[style.--rarity]': 'color()',
    '[class.over]': 'over()',
  },
  styles: `
    :host {
      --corner: var(--radius-md);
      --rarity-from: var(--rarity);
      --rarity-to: color-mix(in srgb, var(--rarity) 60%, var(--color-rarity-shade));
      position: absolute;
      z-index: 0;
      inset-block-end: calc(100% - var(--corner) - 2px);
      inset-inline-end: 0;
      display: grid;
      place-items: start center;
      min-inline-size: var(--rarity-tab-min, 3rem);
      block-size: calc(var(--rarity-tab-height, 1.5rem) + var(--corner) + 2px);
      padding: calc((var(--rarity-tab-height, 1.5rem) - 1em) / 2) var(--space-2) 0
        calc(var(--space-2) + var(--rarity-tab-slant, 0.8rem) - 0.1rem);
      border: 0;
      background: linear-gradient(135deg, var(--rarity-from) 20%, var(--rarity-to));
      color: var(--color-on-rarity);
      clip-path: polygon(var(--rarity-tab-slant, 0.8rem) 0, 100% 0, 100% 100%, 0 100%);
      font-family: var(--font-family-display);
      font-size: var(--rarity-tab-font, var(--font-size-sm));
      font-weight: var(--font-weight-bold);
      line-height: 1;
      text-shadow: 0 1px 2px var(--color-rarity-shade);
    }
    /* Over the card: inside its top-right corner (rounded like it), above it, the slant leaning the other way */
    :host(.over) {
      z-index: 2;
      inset-block: 0 auto;
      block-size: var(--rarity-tab-height, 1.5rem);
      place-items: center;
      padding-block: 0;
      border-start-end-radius: var(--corner);
      clip-path: polygon(0 0, 100% 0, 100% 100%, var(--rarity-tab-slant, 0.8rem) 100%);
      pointer-events: none;
    }
    :host([data-rarity='UC']) {
      --rarity-to: color-mix(in srgb, var(--color-rarity-uc) 45%, var(--color-rarity-r));
    }
    :host([data-rarity='R']) {
      --rarity-from: var(--color-rarity-r);
      --rarity-to: color-mix(in srgb, var(--color-rarity-r) 45%, var(--color-rarity-sec));
    }
    :host([data-rarity='SR']) {
      --rarity-to: color-mix(in srgb, var(--color-rarity-sr) 55%, var(--color-rarity-sec));
    }
    :host([data-rarity='SEC']) {
      --rarity-to: color-mix(in srgb, var(--color-rarity-sec) 40%, var(--color-rarity-r));
    }
    :host(button) {
      cursor: pointer;
    }
    :host(button:hover) {
      filter: brightness(1.1);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RarityTabComponent {
  /** The rarity (C, UC, R, SR, SEC); none shows a dash. */
  readonly erasRarityTab = input<string | null | undefined>(null);
  /** Over the card, inside its top-right corner (no room above it needed). */
  readonly over = input(false, { transform: booleanAttribute });
  protected color(): string {
    return rarityColor(this.erasRarityTab());
  }
}
