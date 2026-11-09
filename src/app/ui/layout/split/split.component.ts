import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Two columns: a fixed-width [split-aside] and the main content; stacks on narrow screens.
 * `asideHidden` gives the whole width to the main content.
 * `fill`: the height it is given (inside a `fill` page) and no more; each column scrolls by itself, so the page
 * around it stays in place.
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

    :host(.fill) {
      flex: 1;
      grid-template-rows: minmax(0, 1fr);
      align-items: stretch;
      min-block-size: 0;
    }
    :host(.fill) .aside,
    :host(.fill) .main {
      min-block-size: 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: none;
    }
    /* Stacked (narrow screens): the aside on top takes at most half the height, the main column the rest */
    @media (max-width: 56rem) {
      :host(.fill:not(.aside-hidden)) { grid-template-rows: auto minmax(0, 1fr); }
      :host(.fill) .aside { max-block-size: 50dvh; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--split-aside]': 'aside()', '[class.aside-hidden]': 'asideHidden()', '[class.fill]': 'fill()' },
})
export class SplitComponent {
  readonly aside = input('18rem');
  readonly asideHidden = input(false, { transform: booleanAttribute });
  readonly fill = input(false, { transform: booleanAttribute });
}
