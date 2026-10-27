import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Two columns: a fixed-width [split-aside] and the main content; stacks on narrow screens.
 * `asideHidden` gives the whole width to the main content.
 * <eras-split aside="18rem"><div split-aside>…</div> …main… </eras-split>
 */
@Component({
  selector: 'eras-split',
  template: `
    @if (!asideHidden()) {
      <div class="aside"><ng-content select="[split-aside]" /></div>
    }
    <div class="main"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: var(--split-aside) minmax(0, 1fr);
      gap: var(--space-5);
      align-items: start;
    }
    :host(.aside-hidden) { grid-template-columns: minmax(0, 1fr); }
    @media (max-width: 56rem) {
      :host { grid-template-columns: minmax(0, 1fr); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--split-aside]': 'aside()', '[class.aside-hidden]': 'asideHidden()' },
})
export class SplitComponent {
  readonly aside = input('18rem');
  readonly asideHidden = input(false, { transform: booleanAttribute });
}
