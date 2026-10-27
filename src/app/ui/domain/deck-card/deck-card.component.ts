import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { IconComponent } from '../../primitives/icon/icon.component';
import { CardComponent } from '../../surfaces/card/card.component';

/** Deck in a grid: cover, card count, name and author. Buttons go into [deck-actions]. */
@Component({
  selector: 'eras-deck-card',
  imports: [CardComponent, IconComponent],
  template: `
    <eras-card padding="none" interactive>
      <button type="button" class="open" [attr.aria-label]="'Ver ' + name()" (click)="selected.emit()">
        <span class="cover">
          @if (imageUrl()) {
            <img [src]="imageUrl()" alt="" loading="lazy" />
          } @else {
            <eras-icon name="cards" />
          }
          <span class="count">{{ cardCount() }} cartas</span>
          @if (isPrivate()) {
            <span class="private">Privado</span>
          }
        </span>
        <span class="info">
          <span class="name">{{ name() }}</span>
          @if (author()) {
            <span class="author">por {{ author() }}</span>
          }
        </span>
      </button>
      <div class="actions"><ng-content select="[deck-actions]" /></div>
    </eras-card>
  `,
  styles: `
    :host { display: block; }
    eras-card { block-size: 100%; display: flex; flex-direction: column; }
    .open {
      display: flex;
      flex-direction: column;
      flex: 1;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      text-align: start;
      cursor: pointer;
    }
    .cover {
      position: relative;
      display: grid;
      place-items: center;
      aspect-ratio: 63 / 50;
      overflow: hidden;
      background: var(--color-surface-muted);
      color: var(--color-text-subtle);
      font-size: var(--font-size-2xl);
    }
    .cover img { inline-size: 100%; block-size: 100%; object-fit: cover; object-position: top; }
    .count, .private {
      position: absolute;
      inset-block-end: var(--space-2);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 70%);
      color: #fff;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
    }
    .count { inset-inline-end: var(--space-2); }
    .private { inset-inline-start: var(--space-2); }
    .info { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-3) var(--space-4) var(--space-2); }
    .name { font-weight: var(--font-weight-bold); overflow-wrap: anywhere; }
    .author { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); padding: var(--space-2) var(--space-4) var(--space-4); }
    .actions:empty { display: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckCardComponent {
  readonly name = input.required<string>();
  readonly author = input<string | null>(null);
  readonly imageUrl = input<string | null>(null);
  readonly cardCount = input(0);
  readonly isPrivate = input(false, { transform: booleanAttribute });
  readonly selected = output<void>();
}
