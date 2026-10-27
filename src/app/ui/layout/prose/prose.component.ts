import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/** Readable long-form text (rules, help): spacing and measure for projected headings, paragraphs and lists. */
@Component({
  selector: 'eras-prose',
  template: '<ng-content />',
  styles: `
    .eras-prose { display: block; max-inline-size: 72ch; line-height: var(--line-height-base); }
    .eras-prose > * + * { margin-block-start: var(--space-3); }
    .eras-prose h2 { margin-block-start: var(--space-6); font-size: var(--font-size-xl); }
    .eras-prose h3 { margin-block-start: var(--space-5); font-family: var(--font-family-base); font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); }
    .eras-prose h2:first-child, .eras-prose h3:first-child { margin-block-start: 0; }
    .eras-prose ul, .eras-prose ol { padding-inline-start: var(--space-5); }
    .eras-prose li + li { margin-block-start: var(--space-1); }
    .eras-prose code { padding: 0 var(--space-1); border-radius: var(--radius-sm); background: var(--color-surface-muted); }
    .eras-prose img { max-inline-size: 100%; block-size: auto; border-radius: var(--radius-md); }
  `,
  // Not encapsulated: it styles projected content. Selectors are namespaced.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'eras-prose' },
})
export class ProseComponent {}
