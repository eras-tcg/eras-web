import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** One tier of a tier list: colored label on the left, its items (projected) on the right. */
@Component({
  selector: 'eras-tier-row',
  template: `
    <div class="label" [style.background]="color()">{{ label() }}</div>
    <div class="items"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 4.5rem minmax(0, 1fr);
      flex: 1;
      min-block-size: 4.5rem;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--color-surface);
      transition: outline-color var(--duration-fast) var(--easing-standard);
      outline: 2px dashed transparent;
      outline-offset: -2px;
    }
    :host(.drop-target) { outline-color: var(--color-primary); }
    .label {
      display: grid;
      place-items: center;
      // Tier colors are light pastels, so a fixed dark text keeps the label readable in both themes
      color: #1b1d24;
      font-family: var(--font-family-display);
      font-size: var(--font-size-2xl);
      text-align: center;
    }
    .items { display: flex; align-items: stretch; gap: var(--space-2); min-block-size: 0; padding: var(--space-2); overflow-x: auto; }
    .label { font-size: clamp(var(--font-size-lg), 4vh, var(--font-size-2xl)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.drop-target]': 'dropTarget()' },
})
export class TierRowComponent {
  readonly label = input.required<string>();
  readonly color = input('#B2BEC3');
  readonly dropTarget = input(false, { transform: booleanAttribute });
}
