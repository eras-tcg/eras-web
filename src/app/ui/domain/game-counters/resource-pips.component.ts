import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/** Gem marker of a player: 5 pips; the owner changes it with − / +. */
@Component({
  selector: 'eras-resource-pips',
  template: `
    @if (editable()) {
      <button type="button" aria-label="Quitar una gema del contador" [disabled]="value() <= 0" (click)="valueChange.emit(value() - 1)">−</button>
    }
    <span class="pips" role="img" [attr.aria-label]="'Contador de gemas: ' + value() + ' de ' + max()">
      @for (i of pips; track i) {
        <span class="pip" [class.on]="i <= value()"></span>
      }
    </span>
    @if (editable()) {
      <button type="button" aria-label="Sumar una gema al contador" [disabled]="value() >= max()" (click)="valueChange.emit(value() + 1)">+</button>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: var(--space-2); }
    .pips { display: inline-flex; gap: 0.45rem; padding: 0.3rem 0.5rem; }
    // Each point is a cut gem: an empty socket, or lit (green, with a shine)
    .pip {
      inline-size: 1rem;
      block-size: 1rem;
      border: 2px solid var(--color-border);
      border-radius: 3px;
      background: color-mix(in srgb, var(--color-surface-muted) 80%, transparent);
      transform: rotate(45deg);
      transition: background var(--duration-fast, 120ms) ease, box-shadow var(--duration-fast, 120ms) ease;
    }
    .pip.on {
      border-color: #15803d;
      background: radial-gradient(circle at 30% 30%, #bbf7d0 0 18%, #22c55e 45%, #15803d 100%);
      box-shadow: 0 0 8px 1px rgb(34 197 94 / 55%);
    }
    button {
      inline-size: 1.4rem;
      block-size: 1.4rem;
      padding: 0;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-muted);
      color: var(--color-text);
      cursor: pointer;
    }
    button:disabled { opacity: 0.4; cursor: default; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourcePipsComponent {
  readonly value = input(0);
  readonly max = input(5);
  readonly editable = input(false, { transform: booleanAttribute });
  readonly valueChange = output<number>();
  protected readonly pips = [1, 2, 3, 4, 5];
}
