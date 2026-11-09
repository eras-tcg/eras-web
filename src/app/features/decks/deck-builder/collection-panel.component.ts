import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { CRAFT_COST, FINISHES, FRAGMENTS_OF } from '@data/collection/collection-rules';
import { CollectionStore } from '@data/collection/collection.store';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CollectionAction, CollectionActionData, CollectionActionDialogComponent } from './collection-action-dialog.component';

/**
 * A card in the player's collection, under its image in the deck builder: craft or break copies (each asks how many),
 * and craft until a finish comes out (with a limit of fragments). Each crafted copy's finish comes at random.
 */
@Component({
  selector: 'eras-collection-panel',
  imports: [ButtonComponent],
  template: `
    <div class="row">
      <button erasButton size="sm" type="button" [disabled]="fragments() < cost || store.busy()" (click)="open('craft')">Fabricar −{{ cost }}</button>
      <button erasButton variant="secondary" size="sm" type="button" [disabled]="!plainest() || store.busy()" (click)="open('break')">
        Romper +{{ gain() }}
      </button>
    </div>
    <button erasButton variant="secondary" size="sm" type="button" class="wide" [disabled]="fragments() < cost || store.busy()" (click)="open('finish')">
      Fabricar acabado
    </button>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    /* Side by side when they fit; one under the other in a narrow pane (phones in landscape) */
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(6.5rem, 100%), 1fr)); gap: var(--space-2); }
    .wide { inline-size: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPanelComponent {
  readonly card = input.required<CatalogCard>();

  protected readonly store = inject(CollectionStore);
  private readonly modal = inject(ModalService);

  protected readonly cost = CRAFT_COST;
  private readonly rarity = computed(() => this.card().meta?.rarity || 'C');
  protected readonly fragments = computed(() => this.store.fragments()[this.rarity()] ?? 0);
  /** The finish breaking takes first (the plainest owned), or null when none is owned. */
  protected readonly plainest = computed(() => {
    const copies = this.store.collection()?.cards[this.card().id];
    return FINISHES.find((f) => (copies?.[f] ?? 0) > 0) ?? null;
  });
  protected readonly gain = computed(() => FRAGMENTS_OF[this.plainest() ?? 'plain']);

  protected open(action: CollectionAction): void {
    const data: CollectionActionData = { card: this.card(), action };
    this.modal.open(CollectionActionDialogComponent, { data });
  }
}
