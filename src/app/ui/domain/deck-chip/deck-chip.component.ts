import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Small deck tile (cover + name) linking to the deck. Controls go into [chip-actions]. */
@Component({
  selector: 'eras-deck-chip',
  imports: [RouterLink],
  template: `
    <a class="open" [routerLink]="link()">
      <span class="cover">
        @if (imageUrl()) {
          <img [src]="imageUrl()" alt="" loading="lazy" />
        }
      </span>
      <span class="name">{{ name() }}</span>
    </a>
    <div class="actions"><ng-content select="[chip-actions]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      inline-size: 7.5rem;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--color-surface-muted);
    }
    .open { display: flex; flex-direction: column; color: inherit; text-decoration: none; }
    .cover { aspect-ratio: 63 / 50; overflow: hidden; background: var(--color-bg); }
    .cover img { inline-size: 100%; block-size: 100%; object-fit: cover; object-position: top; }
    .name { padding: var(--space-1) var(--space-2); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); text-align: center; overflow-wrap: anywhere; }
    .actions { display: flex; justify-content: center; gap: var(--space-1); padding: 0 var(--space-1) var(--space-1); }
    .actions:empty { display: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckChipComponent {
  readonly name = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly link = input.required<string[]>();
}
