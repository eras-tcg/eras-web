import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** Frame of a table zone (deck, tributes, discard, lives, hand): label, count and drop / target highlights. */
@Component({
  selector: 'eras-game-zone',
  template: `
    <span class="label">{{ label() }}@if (count() !== null) { <span class="count">{{ count() }}</span> }</span>
    <div class="content"><ng-content /></div>
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
      display: flex;
      justify-content: space-between;
      gap: var(--space-1);
      color: var(--color-text-muted);
      font-size: 0.8rem;
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .count { color: var(--color-text); font-size: 1rem; }
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
  readonly label = input.required<string>();
  readonly count = input<number | null>(null);
  readonly dropActive = input(false, { transform: booleanAttribute });
  readonly targeted = input(false, { transform: booleanAttribute });
  readonly selectable = input(false, { transform: booleanAttribute });
}
