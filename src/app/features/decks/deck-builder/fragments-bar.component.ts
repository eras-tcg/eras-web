import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CollectionStore } from '@data/collection/collection.store';
import { RARITY_NAMES } from '@data/editions/booster-rules';
import { RARITIES } from '@data/editions/edition.model';

/**
 * The player's fragments of each rarity, in the top row next to the gems (as the quick buttons: a shard in the
 * rarity's color over the amount).
 */
@Component({
  selector: 'eras-fragments-bar',
  imports: [DecimalPipe],
  template: `
    @for (rarity of rarities; track rarity) {
      <span class="item" [title]="(fragments()[rarity] ?? 0) + ' fragmentos de rareza ' + names[rarity]" [style.--shard]="'var(--color-rarity-' + rarity.toLowerCase() + ')'">
        <span class="shard" aria-hidden="true"></span>
        <span class="label">{{ fragments()[rarity] ?? 0 | number: '1.0-0' : 'es' }} {{ rarity }}</span>
      </span>
    }
  `,
  styles: `
    :host {
      display: flex;
      gap: 0;
      color: var(--color-text-muted);
    }
    .item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      min-inline-size: 2.5rem;
      padding: var(--space-1) 0;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    // A shard: a broken piece of a gem, in the rarity's color
    .shard {
      inline-size: 1.1rem;
      block-size: 1.5rem;
      background: linear-gradient(135deg, color-mix(in srgb, var(--shard) 55%, var(--color-hub-text)), var(--shard) 60%);
      clip-path: polygon(50% 0, 100% 35%, 80% 100%, 15% 85%, 0 30%);
      filter: drop-shadow(0 0 2px color-mix(in srgb, var(--shard) 60%, transparent));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-label': 'Tus fragmentos' },
})
export class FragmentsBarComponent {
  private readonly collection = inject(CollectionStore);

  protected readonly rarities = RARITIES;
  protected readonly names = RARITY_NAMES;
  protected readonly fragments = this.collection.fragments;
}
