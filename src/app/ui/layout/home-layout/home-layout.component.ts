import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Landing layout that fits one screen on desktop, laid out on one card size:
 * a big card-shaped feature (as tall as two rows of items), a 3×2 grid of card-shaped items and a side
 * column that scrolls on its own. The card height is the largest that fits both the width and the height.
 * Stacks normally on small screens.
 *
 * <eras-home-layout featureTitle="Edición destacada" mainTitle="Mazos destacados" sideTitle="Noticias">
 *   <div home-toolbar>…</div> <div home-feature>…</div> <div home-main>…6 items…</div> <div home-side>…</div>
 * </eras-home-layout>
 */
@Component({
  selector: 'eras-home-layout',
  template: `
    <div class="toolbar"><ng-content select="[home-toolbar]" /></div>
    <div class="layout">
      <section class="feature" [attr.aria-label]="featureTitle()">
        <h2 class="title">{{ featureTitle() }}</h2>
        <div class="feature-body"><ng-content select="[home-feature]" /></div>
      </section>
      <section class="main" [attr.aria-label]="mainTitle()">
        <h2 class="title">{{ mainTitle() }}</h2>
        <div class="items"><ng-content select="[home-main]" /></div>
      </section>
      <aside class="side" [attr.aria-label]="sideTitle()">
        <h2 class="title">{{ sideTitle() }}</h2>
        <div class="side-content"><ng-content select="[home-side]" /></div>
      </aside>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      inline-size: 100%;
      gap: var(--space-3);
      max-inline-size: 110rem;
      margin-inline: auto;
      padding: var(--space-4) var(--layout-gutter);
    }
    .toolbar:empty {
      display: none;
    }
    .layout {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }
    .title {
      block-size: 1.1rem;
      margin: 0 0 var(--space-3);
      color: var(--color-text-muted);
      font-family: var(--font-family-base);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      line-height: 1.1rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .feature-body {
      display: grid;
      grid-template-rows: minmax(0, 1fr);
      block-size: 24rem;
    }
    /* Small screens: cells with a set height, items fit them */
    .items {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: 15rem;
      gap: var(--space-3);
    }
    @media (min-width: 40rem) {
      .items {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        grid-auto-rows: 17rem;
      }
    }
    .side-content {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    /* Desktop: one screen, every column the same height, all sized from one card height (--h) */
    @media (min-width: 64rem) {
      :host {
        /* --app-header-height is set by the app shell */
        block-size: calc(100dvh - var(--app-header-height, 3.5rem));
        min-block-size: 32rem;
      }
      .layout {
        flex: 1;
        flex-direction: row;
        justify-content: center;
        min-block-size: 0;
        container-type: size;
      }
      .feature,
      .main,
      .side {
        /* r: card ratio, g: gap between cards, c: gap between columns, t: column title, n: minimum side width */
        --r: 0.716;
        --g: var(--space-3);
        --c: var(--space-5);
        --t: calc(1.1rem + var(--space-3));
        --n: 14rem;
        --h: min(
          (100cqb - var(--t) - var(--g)) / 2,
          (100cqi - var(--n) - 2 * var(--c) - 2 * var(--g) - var(--r) * var(--g)) / (5 * var(--r))
        );

        display: flex;
        flex-direction: column;
        min-block-size: 0;
      }
      .feature {
        flex: none;
        inline-size: calc((2 * var(--h) + var(--g)) * var(--r));
      }
      .feature-body {
        block-size: calc(2 * var(--h) + var(--g));
      }
      .main {
        flex: none;
      }
      .items {
        grid-template-columns: repeat(3, calc(var(--h) * var(--r)));
        grid-template-rows: repeat(2, var(--h));
        grid-auto-rows: unset;
      }
      .side {
        flex: 1;
        min-inline-size: var(--n);
        max-inline-size: 26rem;
      }
      .side-content {
        block-size: calc(2 * var(--h) + var(--g));
        padding-inline-end: var(--space-1);
        overflow-y: auto;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeLayoutComponent {
  readonly featureTitle = input.required<string>();
  readonly mainTitle = input.required<string>();
  readonly sideTitle = input.required<string>();
}
