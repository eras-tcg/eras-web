import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { CardImageComponent } from '../card-image/card-image.component';

/** Clickable card in a grid; `count` shows "×N" in the corner, `dimmed` greys it out. */
@Component({
  selector: 'eras-card-thumb',
  imports: [CardImageComponent],
  template: `
    <button type="button" [attr.aria-label]="label()" [class.dimmed]="dimmed()" [class.active]="active()" (click)="selected.emit()">
      <eras-card-image [src]="imageUrl()" [alt]="name()" [badge]="badge()" [badgeTone]="badgeTone()" />
      @if (count() > 1 || (showSingleCount() && count() === 1)) {
        <span class="count">×{{ count() }}</span>
      }
    </button>
  `,
  styles: `
    :host { display: block; }
    button {
      position: relative;
      display: block;
      inline-size: 100%;
      padding: 0;
      border: 0;
      border-radius: var(--radius-md);
      background: none;
      cursor: pointer;
      transition: transform var(--duration-fast) var(--easing-standard), opacity var(--duration-fast) var(--easing-standard);
    }
    button:hover { transform: translateY(-2px); }
    button.active { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    button.dimmed { opacity: 0.4; }
    .count {
      position: absolute;
      inset-block-start: var(--space-2);
      inset-inline-end: var(--space-2);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 75%);
      color: #fff;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardThumbComponent {
  readonly name = input('');
  readonly imageUrl = input<string | null>(null);
  readonly badge = input<string | null>(null);
  readonly badgeTone = input<'danger' | 'info'>('danger');
  readonly count = input(0);
  /** Also show "×1" (e.g. in a search list, where 1 means "one already in the deck"). */
  readonly showSingleCount = input(false, { transform: booleanAttribute });
  readonly dimmed = input(false, { transform: booleanAttribute });
  readonly active = input(false, { transform: booleanAttribute });
  readonly selected = output<void>();

  protected label(): string {
    const name = this.name() || 'Carta';
    return this.count() > 0 ? `${name}, ${this.count()} en el mazo` : name;
  }
}
