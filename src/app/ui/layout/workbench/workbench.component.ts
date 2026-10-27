import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Three working panes: [pane-start] | main | [pane-end]. Each pane scrolls on its own on wide
 * screens; on medium screens the start pane moves below; on narrow ones they stack.
 */
@Component({
  selector: 'eras-workbench',
  template: `
    <section class="pane start"><ng-content select="[pane-start]" /></section>
    <section class="pane main"><ng-content /></section>
    <section class="pane end"><ng-content select="[pane-end]" /></section>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr) minmax(18rem, 26rem);
      grid-template-areas: 'start main end';
      gap: var(--space-4);
      block-size: calc(100dvh - 8rem);
      min-block-size: 32rem;
    }
    .pane {
      min-inline-size: 0;
      min-block-size: 0;
      overflow: auto;
      padding: var(--space-4);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
    }
    .start { grid-area: start; }
    .main { grid-area: main; }
    .end { grid-area: end; }
    @media (max-width: 75rem) {
      :host {
        grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
        grid-template-areas: 'main end' 'start end';
        grid-template-rows: minmax(0, 1fr) auto;
      }
      .start { max-block-size: 24rem; }
    }
    @media (max-width: 48rem) {
      :host {
        display: flex;
        flex-direction: column;
        block-size: auto;
      }
      .pane { overflow: visible; }
      .main { order: 1; }
      .end { order: 2; max-block-size: 80dvh; overflow: auto; }
      .start { order: 3; max-block-size: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkbenchComponent {}
