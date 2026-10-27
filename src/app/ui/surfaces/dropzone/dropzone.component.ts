import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** Area that highlights while something is dragged over it (`active`). The page handles the drag events. */
@Component({
  selector: 'eras-dropzone',
  template: '<ng-content />',
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      min-block-size: 10rem;
      padding: var(--space-3);
      border: 2px dashed transparent;
      border-radius: var(--radius-lg);
      transition: border-color var(--duration-fast) var(--easing-standard), background-color var(--duration-fast) var(--easing-standard);
    }
    :host(.active) { border-color: var(--color-primary); background: var(--color-surface-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.active]': 'active()' },
})
export class DropzoneComponent {
  readonly active = input(false, { transform: booleanAttribute });
}
