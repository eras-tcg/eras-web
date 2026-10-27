import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CardImageComponent } from '../card-image/card-image.component';

/** Clickable card in a grid. */
@Component({
  selector: 'eras-card-thumb',
  imports: [CardImageComponent],
  template: `
    <button type="button" [attr.aria-label]="name() || 'Carta'" (click)="selected.emit()">
      <eras-card-image [src]="imageUrl()" [alt]="name()" [badge]="badge()" />
    </button>
  `,
  styles: `
    :host { display: block; }
    button {
      display: block;
      inline-size: 100%;
      padding: 0;
      border: 0;
      border-radius: var(--radius-md);
      background: none;
      cursor: pointer;
      transition: transform var(--duration-fast) var(--easing-standard);
    }
    button:hover { transform: translateY(-2px); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardThumbComponent {
  readonly name = input('');
  readonly imageUrl = input<string | null>(null);
  readonly badge = input<string | null>(null);
  readonly selected = output<void>();
}
