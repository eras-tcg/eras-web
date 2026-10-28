import { ChangeDetectionStrategy, Component, booleanAttribute, input, numberAttribute, output } from '@angular/core';
import { IconComponent } from '../../primitives/icon/icon.component';

/**
 * Deck shown like a card (63:88): cover art, name and author over a gradient, optional rank and card count.
 * Buttons go into [cover-actions] (top-right corner).
 * With `fit`, the cover takes the largest card-shaped size that fits its box (e.g. a grid cell with a set height).
 */
@Component({
  selector: 'eras-deck-cover',
  imports: [IconComponent],
  template: `
    <div class="cover" [class.empty]="!name()">
      <button type="button" class="open" [attr.aria-label]="name() ? 'Ver ' + name() : 'Espacio vacío'" [disabled]="!name()" (click)="selected.emit()">
        @if (imageUrl()) {
          <img [src]="imageUrl()" alt="" loading="lazy" />
        } @else {
          <span class="placeholder" aria-hidden="true"><eras-icon name="stack" /></span>
        }
        <span class="shade" aria-hidden="true"></span>
        @if (rank()) {
          <span class="rank">#{{ rank() }}</span>
        }
        <span class="info">
          @if (isPrivate() || cardCount() !== null) {
            <span class="badges">
              @if (isPrivate()) {
                <span class="badge">Privado</span>
              }
              @if (cardCount() !== null) {
                <span class="badge">{{ cardCount() }} cartas</span>
              }
            </span>
          }
          <span class="name">{{ name() || 'Vacío' }}</span>
          @if (author()) {
            <span class="author">{{ author() }}</span>
          }
        </span>
      </button>
      <div class="actions"><ng-content select="[cover-actions]" /></div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    /* Small fixed size, for rows of decks (tier list) */
    :host(.size-sm) {
      inline-size: 7.5rem;
    }
    :host(.size-sm) .name {
      font-size: var(--font-size-xs);
    }
    :host(.size-sm) .info {
      inset-inline: var(--space-2);
      inset-block-end: var(--space-2);
    }
    :host(.fit) {
      container-type: size;
      display: grid;
      place-items: center;
      block-size: 100%;
      min-block-size: 0;
    }
    .cover {
      position: relative;
      inline-size: 100%;
      aspect-ratio: 63 / 88;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-surface-muted);
      box-shadow: var(--shadow-sm);
      transition:
        transform var(--duration-fast) var(--easing-standard),
        box-shadow var(--duration-fast) var(--easing-standard);
    }
    :host(.fit) .cover {
      inline-size: min(100cqi, 100cqb * 63 / 88);
    }
    .cover:not(.empty):hover {
      box-shadow: var(--shadow-lg);
      transform: translateY(-2px);
    }
    .cover.empty {
      border: 2px dashed var(--color-border);
      background: transparent;
      box-shadow: none;
    }
    .open {
      position: absolute;
      inset: 0;
      padding: 0;
      border: 0;
      background: none;
      color: #fff;
      text-align: start;
      cursor: pointer;
    }
    .open:disabled {
      cursor: default;
    }
    .open:focus-visible {
      outline: 3px solid var(--color-focus);
      outline-offset: -3px;
    }
    img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      object-position: top;
    }
    .placeholder {
      display: grid;
      place-items: center;
      block-size: 100%;
      color: var(--color-text-subtle);
    }
    .placeholder eras-icon {
      inline-size: 2.5rem;
      block-size: 2.5rem;
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgb(0 0 0 / 88%) 0%, rgb(0 0 0 / 45%) 32%, transparent 58%);
    }
    .empty .shade {
      display: none;
    }
    .rank {
      position: absolute;
      inset-block-start: var(--space-2);
      inset-inline-start: var(--space-2);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 70%);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
    }
    .empty .rank {
      background: var(--color-surface-muted);
      color: var(--color-text-muted);
    }
    .badges {
      display: flex;
      margin-block-end: var(--space-1);
      flex-wrap: wrap;
      gap: var(--space-1);
    }
    .badge {
      padding: 0.1rem var(--space-2);
      border: 1px solid rgb(255 255 255 / 35%);
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 45%);
      font-size: 0.7rem;
      font-weight: var(--font-weight-medium);
    }
    .info {
      position: absolute;
      inset-inline: var(--space-3);
      inset-block-end: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .name {
      display: -webkit-box;
      overflow: hidden;
      font-weight: var(--font-weight-bold);
      line-height: var(--line-height-tight);
      text-shadow: 0 1px 3px rgb(0 0 0 / 60%);
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .empty .name {
      color: var(--color-text-muted);
      text-shadow: none;
    }
    .author {
      overflow: hidden;
      color: rgb(255 255 255 / 75%);
      font-size: var(--font-size-xs);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .actions {
      position: absolute;
      inset-block-start: var(--space-2);
      inset-inline-end: var(--space-2);
      display: flex;
      gap: var(--space-1);
    }
    .actions:empty {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.fit]': 'fit()', '[class.size-sm]': "size() === 'sm'" },
})
export class DeckCoverComponent {
  readonly name = input<string | null>(null);
  readonly author = input<string | null>(null);
  readonly imageUrl = input<string | null>(null);
  readonly cardCount = input<number | null>(null);
  readonly rank = input(null, { transform: (v: unknown) => (v == null ? null : numberAttribute(v)) });
  readonly isPrivate = input(false, { transform: booleanAttribute });
  readonly fit = input(false, { transform: booleanAttribute });
  /** auto: fills its grid cell; sm: fixed 7.5rem wide. */
  readonly size = input<'auto' | 'sm'>('auto');
  readonly selected = output<void>();
}
