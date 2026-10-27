import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Button that opens the file picker and emits the chosen file. */
@Component({
  selector: 'eras-file-button',
  template: `
    <label class="button">
      <ng-content />
      <input type="file" [accept]="accept()" (change)="pick($event)" />
    </label>
  `,
  styles: `
    :host { display: inline-flex; }
    .button {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
      color: var(--color-text);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
    }
    .button:hover { border-color: var(--color-text-muted); }
    .button:focus-within { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    input { position: absolute; inline-size: 1px; block-size: 1px; opacity: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileButtonComponent {
  readonly accept = input('');
  readonly file = output<File>();

  protected pick(event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (file) this.file.emit(file);
  }
}
