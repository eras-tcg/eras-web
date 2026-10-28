import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Landing layout that fits one screen on desktop: feature column, main area (two rows of items that shrink
 * to the available height) and a side column that scrolls on its own. Stacks normally on small screens.
 *
 * <eras-home-layout mainTitle="Mazos destacados" sideTitle="Noticias">
 *   <div home-toolbar>…</div> <div home-feature>…</div> <div home-main>…6 items…</div> <div home-side>…</div>
 * </eras-home-layout>
 */
@Component({
  selector: 'eras-home-layout',
  template: `
    <div class="toolbar"><ng-content select="[home-toolbar]" /></div>
    <div class="layout">
      <section class="feature"><ng-content select="[home-feature]" /></section>
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
      max-inline-size: 90rem;
      margin-inline: auto;
      padding: var(--space-4) var(--layout-gutter);
    }
    .toolbar:empty {
      display: none;
    }
    .layout {
      display: grid;
      gap: var(--space-5);
    }
    .title {
      margin: 0 0 var(--space-3);
      color: var(--color-text-muted);
      font-family: var(--font-family-base);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .feature {
      display: grid;
      grid-template-rows: minmax(16rem, 1fr);
    }
    /* Items fit their cell: give rows a height on small screens */
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

    /* Desktop: everything in the viewport below the navbar, no page scroll */
    @media (min-width: 64rem) {
      :host {
        /* --app-header-height is set by the app shell */
        block-size: calc(100dvh - var(--app-header-height, 3.5rem));
        min-block-size: 34rem;
      }
      .layout {
        flex: 1;
        grid-template-columns: minmax(15rem, 20rem) minmax(0, 1fr) minmax(15rem, 19rem);
        grid-template-rows: minmax(0, 1fr);
        min-block-size: 0;
      }
      .feature,
      .main,
      .side {
        display: flex;
        flex-direction: column;
        min-block-size: 0;
      }
      .feature {
        grid-template-rows: minmax(0, 1fr);
      }
      .items {
        flex: 1;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        grid-template-rows: repeat(2, minmax(0, 1fr));
        grid-auto-rows: unset;
        min-block-size: 0;
      }
      .side-content {
        flex: 1;
        min-block-size: 0;
        padding-inline-end: var(--space-1);
        overflow-y: auto;
        scrollbar-width: thin;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeLayoutComponent {
  readonly mainTitle = input.required<string>();
  readonly sideTitle = input.required<string>();
}
