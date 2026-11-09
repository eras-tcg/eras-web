import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Column of tier rows that share the height it is given (rows grow equally; no vertical scroll). */
@Component({
  selector: 'eras-tier-board',
  template: '<ng-content />',
  styles: `
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--space-2);
      min-block-size: 0;
    }
    /* Phones in landscape: the rows touch, so every tier fits the short height */
    @media (orientation: landscape) and (max-height: 30rem) {
      :host {
        gap: 0;
        overflow: hidden;
        border: var(--border-width) solid var(--color-border);
        border-radius: var(--radius-md);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TierBoardComponent {}
