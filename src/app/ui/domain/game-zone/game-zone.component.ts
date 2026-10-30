import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';

/**
 * Frame of a table zone (deck, tributes, discard, lives, hand): its title (none for the hand), drop / target highlights and,
 * when the table shows its information, how many cards it holds, big over its content.
 */
@Component({
  selector: 'eras-game-zone',
  imports: [IconComponent],
  template: `
    @if (label()) {
      <span class="label">{{ label() }}</span>
    }
    <div class="content"><ng-content /></div>
    @if (count() !== null) {
      <span class="count" [attr.aria-label]="count() + ' ' + (count() === 1 ? 'carta' : 'cartas')">@if (countIcon(); as icon) {<eras-icon [name]="icon" />}{{ count() }}</span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-inline-size: 0;
      min-block-size: 0;
      padding: var(--space-1);
      border: 2px dashed var(--color-border);
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--color-surface) 70%, transparent);
      transition: border-color var(--duration-fast) var(--easing-standard), box-shadow var(--duration-fast) var(--easing-standard);
    }
    :host(.drop-active) { border-color: var(--color-primary); border-style: solid; }
    :host(.targeted) { box-shadow: 0 0 0 3px var(--color-danger), 0 0 14px var(--color-danger); }
    :host(.selectable) { cursor: crosshair; }
    .label {
      color: var(--color-text-muted);
      font-size: 0.8rem;
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.06em;
      text-align: center;
      text-transform: uppercase;
    }
    /* The number of cards, big and centered over the pile (only with the table's information on) */
    .count {
      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 50%;
      z-index: 6;
      min-inline-size: 2.4em;
      padding: 0.1em 0.45em;
      transform: translate(-50%, -40%);
      border: 2px solid color-mix(in srgb, var(--color-text) 25%, transparent);
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--color-surface) 82%, transparent);
      box-shadow: 0 4px 14px rgb(0 0 0 / 35%);
      color: var(--color-text);
      font-size: clamp(1.4rem, 3.2vmin, 2.4rem);
      font-weight: var(--font-weight-bold);
      font-variant-numeric: tabular-nums;
      line-height: 1.15;
      text-align: center;
      pointer-events: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.25em;
    }
    .count eras-icon { inline-size: 0.8em; block-size: 0.8em; }
    .content { display: flex; flex: 1; align-items: center; justify-content: center; min-block-size: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.drop-active]': 'dropActive()',
    '[class.targeted]': 'targeted()',
    '[class.selectable]': 'selectable()',
  },
})
export class GameZoneComponent {
  /** Its title; empty for none. */
  readonly label = input('');
  /** How many cards it holds, shown big; null hides it. */
  readonly count = input<number | null>(null);
  /** An icon beside that number (the hand's cards). */
  readonly countIcon = input<IconName | null>(null);
  readonly dropActive = input(false, { transform: booleanAttribute });
  readonly targeted = input(false, { transform: booleanAttribute });
  readonly selectable = input(false, { transform: booleanAttribute });
}
