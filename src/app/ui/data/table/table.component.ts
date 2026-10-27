import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * Styles the projected native <table> (keeps native table semantics for screen readers)
 * and scrolls it horizontally on small screens.
 *
 * <eras-table><table><thead>…</thead><tbody>…</tbody></table></eras-table>
 * Cells with class "actions" align their buttons to the end; "muted" greys secondary text.
 */
@Component({
  selector: 'eras-table',
  template: '<ng-content />',
  styles: `
    .eras-table {
      display: block;
      overflow-x: auto;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
    }
    .eras-table table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--font-size-sm);
    }
    .eras-table th {
      padding: var(--space-3);
      border-block-end: var(--border-width) solid var(--color-border);
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.06em;
      text-align: start;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .eras-table td {
      padding: var(--space-2) var(--space-3);
      border-block-end: var(--border-width) solid var(--color-border);
      vertical-align: middle;
    }
    .eras-table tbody tr:last-child td { border-block-end: 0; }
    .eras-table tbody tr:hover { background: var(--color-surface-muted); }
    .eras-table td.actions, .eras-table th.actions { text-align: end; white-space: nowrap; }
    .eras-table td.actions > * + * { margin-inline-start: var(--space-1); }
    .eras-table .muted { color: var(--color-text-muted); }
  `,
  // Not encapsulated: it styles projected native table elements. All selectors are namespaced.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'eras-table' },
})
export class TableComponent {}
