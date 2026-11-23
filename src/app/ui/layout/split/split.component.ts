import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Two columns: a fixed-width [split-aside] and the main content; stacks on narrow screens.
 * `asideHidden` gives the whole width to the main content: the aside folds away smoothly (its column narrows to
 * nothing while the main one widens) and unfolds the same way; its content stays as it was.
 * `fill`: the height it is given (inside a `fill` page) and no more; each column scrolls by itself, so the page
 * around it stays in place.
 * <eras-split aside="18rem"><div split-aside>…</div> …main… </eras-split>
 */
@Component({
  selector: 'eras-split',
  template: `
    <div class="aside" [attr.inert]="asideHidden() || null">
      <div class="aside-content"><ng-content select="[split-aside]" /></div>
    </div>
    <div class="main"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: var(--split-aside) minmax(0, 1fr);
      gap: var(--space-5);
      align-items: start;
      transition:
        grid-template-columns var(--duration-slow) var(--easing-standard),
        column-gap var(--duration-slow) var(--easing-standard);
    }
    /* Its column narrows to nothing; its content keeps (nearly) its width meanwhile, clipped, then is hidden. Open, the
       content takes the column's inner width (a scrollbar inside it never pushes the content out of sight) */
    .aside { min-inline-size: 0; overflow-x: hidden; }
    .aside-content { inline-size: 100%; min-inline-size: calc(var(--split-aside) - 1.25rem); }
    :host(.aside-hidden) { grid-template-columns: 0 minmax(0, 1fr); column-gap: 0; }
    :host(.aside-hidden) .aside { visibility: hidden; transition: visibility 0s var(--duration-slow); }
    @media (max-width: 56rem) {
      :host { grid-template-columns: minmax(0, 1fr); }
      :host(:not(.fill)) .aside-content { inline-size: auto; }
      :host(:not(.fill).aside-hidden) .aside { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      :host, :host(.aside-hidden) .aside { transition: none; }
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
    /* The aside stays on the left at every width (only the scrolling changes with fill) */
    @media (max-width: 56rem) {
      :host(.fill) { grid-template-columns: var(--split-aside) minmax(0, 1fr); }
      :host(.fill.aside-hidden) { grid-template-columns: 0 minmax(0, 1fr); }
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
