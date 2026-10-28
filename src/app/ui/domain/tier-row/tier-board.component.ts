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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TierBoardComponent {}
