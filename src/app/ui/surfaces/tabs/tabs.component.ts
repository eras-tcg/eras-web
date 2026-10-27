import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TabItem {
  key: string;
  label: string;
}

/** Row of tabs (ARIA tablist). The page renders the selected panel itself. */
@Component({
  selector: 'eras-tabs',
  template: `
    <div role="tablist" [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.key) {
        <button
          type="button"
          role="tab"
          [id]="'tab-' + tab.key"
          [attr.aria-selected]="tab.key === selected()"
          [attr.tabindex]="tab.key === selected() ? 0 : -1"
          (click)="selectedChange.emit(tab.key)"
          (keydown)="onKey($event)"
        >
          {{ tab.label }}
        </button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host { display: block; border-block-end: var(--border-width) solid var(--color-border); }
    [role='tablist'] { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); }
    [role='tab'] {
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-block-end: 2px solid transparent;
      background: none;
      color: var(--color-text-muted);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
    }
    [role='tab'][aria-selected='true'] { border-block-end-color: var(--color-primary); color: var(--color-text); }
    [role='tab']:hover { color: var(--color-text); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent {
  readonly tabs = input.required<TabItem[]>();
  readonly selected = input.required<string>();
  readonly label = input('Pestañas');
  readonly selectedChange = output<string>();

  /** Arrow keys move between tabs, as the ARIA tabs pattern expects. */
  protected onKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const tabs = this.tabs();
    const i = tabs.findIndex((t) => t.key === this.selected());
    const next = tabs[(i + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    if (!next) return;
    this.selectedChange.emit(next.key);
    queueMicrotask(() => document.getElementById('tab-' + next.key)?.focus());
  }
}
