import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Two columns: a fixed-width [split-aside] and the main content; stacks on narrow screens.
 * <eras-split aside="18rem"><div split-aside>…</div> …main… </eras-split>
 */
@Component({
  selector: 'eras-split',
  template: `
    <div class="aside"><ng-content select="[split-aside]" /></div>
    <div class="main"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: var(--split-aside) minmax(0, 1fr);
      gap: var(--space-5);
      align-items: start;
    }
    @media (max-width: 56rem) {
      :host { grid-template-columns: minmax(0, 1fr); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--split-aside]': 'aside()' },
})
export class SplitComponent {
  readonly aside = input('18rem');
}
