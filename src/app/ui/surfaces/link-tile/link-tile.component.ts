import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../primitives/icon/icon.component';

/** Whole-tile link to a page: icon, title, one-line description and an arrow. */
@Component({
  selector: 'eras-link-tile',
  imports: [RouterLink, IconComponent],
  template: `
    <a class="tile" [routerLink]="link()">
      <span class="icon" aria-hidden="true"><eras-icon [name]="icon()" /></span>
      <span class="text">
        <span class="heading">{{ heading() }}</span>
        @if (description()) {
          <span class="description">{{ description() }}</span>
        }
      </span>
      <eras-icon class="arrow" name="chevron-right" />
    </a>
  `,
  styles: `
    .tile {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      block-size: 100%;
      padding: var(--space-4);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text);
      text-decoration: none;
      transition:
        border-color var(--duration-fast) var(--easing-standard),
        box-shadow var(--duration-fast) var(--easing-standard),
        transform var(--duration-fast) var(--easing-standard);
    }
    .tile:hover {
      border-color: var(--color-text-subtle);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
    .tile:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
    .icon {
      display: grid;
      flex-shrink: 0;
      place-items: center;
      inline-size: 2.75rem;
      block-size: 2.75rem;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
    }
    .icon eras-icon {
      inline-size: 1.3rem;
      block-size: 1.3rem;
    }
    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--space-1);
      min-inline-size: 0;
    }
    .heading {
      font-weight: var(--font-weight-bold);
    }
    .description {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .arrow {
      inline-size: 1.1rem;
      block-size: 1.1rem;
      color: var(--color-text-subtle);
      transition: transform var(--duration-fast) var(--easing-standard);
    }
    .tile:hover .arrow {
      color: var(--color-text);
      transform: translateX(2px);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkTileComponent {
  readonly link = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
}
