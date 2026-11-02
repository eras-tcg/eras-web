import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EditDirective } from '@core/auth/edit.directive';
import { EMPTY_FILTERS, filterCards } from '@data/cards/card-filters';
import { CardsStore } from '@data/cards/cards.store';
import { Edition } from '@data/editions/edition.model';
import { pickRandomPackFromBox } from '@data/editions/edition-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { ShopProduct, openingQuery, shopProducts } from '@data/shop/shop-rules';
import { WalletStore } from '@data/shop/wallet.store';
import { RarityBadgeComponent } from '@ui/domain/rarity-badge/rarity-badge.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { EditionFormDialogComponent } from './edition-form/edition-form-dialog.component';
import { ShopCheckout } from './shop-checkout';

/**
 * Editions as a shop, with simulated gems (WalletStore): the editions on the left, the chosen one's showcase on
 * the right (its artwork, description and products: packs and its booster box). Buying asks for confirmation,
 * pays and opens it on /booster-result. One screen high; with manage_editions, create or edit editions.
 */
@Component({
  selector: 'eras-editions-page',
  imports: [DecimalPipe, EditDirective, PageComponent, RarityBadgeComponent, AlertComponent, EmptyStateComponent, ButtonComponent, IconComponent, SpinnerComponent],
  templateUrl: './editions.page.html',
  styleUrl: './editions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionsPage {
  protected readonly store = inject(EditionsStore);
  protected readonly wallet = inject(WalletStore);
  private readonly cardsStore = inject(CardsStore);
  private readonly modal = inject(ModalService);
  private readonly checkout = inject(ShopCheckout);
  private readonly router = inject(Router);

  private readonly chosenId = signal<string | null>(null);
  /** The chosen edition; by default the newest one on sale. */
  protected readonly selected = computed(() => {
    const all = this.store.editions();
    const onSale = all.filter((e) => shopProducts(e).length > 0);
    return all.find((e) => e.editionId === this.chosenId()) ?? onSale.at(-1) ?? all[0] ?? null;
  });
  protected readonly products = computed(() => {
    const edition = this.selected();
    return edition ? shopProducts(edition) : [];
  });

  /** How many cards each edition has in the catalog (as the catalog's edition filter counts them). */
  private readonly counts = computed(() => {
    const all = this.cardsStore.cards();
    return new Map(this.store.editions().map((e) => [e.editionId, filterCards(all, { ...EMPTY_FILTERS, edition: e.editionId }, false).length]));
  });

  constructor() {
    void this.store.load();
    void this.cardsStore.load();
    this.wallet.refresh();
  }

  /** The cards found in the catalog, or the number the edition declares while the catalog loads. */
  protected cardCount(edition: Edition): number {
    return this.counts().get(edition.editionId) || edition.numberOfCards || 0;
  }

  protected choose(edition: Edition): void {
    this.chosenId.set(edition.editionId);
  }

  protected openCards(edition: Edition): void {
    void this.router.navigate(['/cards'], { queryParams: { edition: edition.editionId } });
  }

  protected async buy(edition: Edition, product: ShopProduct): Promise<void> {
    if (!(await this.checkout.purchase(edition, product))) return;
    void this.router.navigate(['/booster-result'], { queryParams: openingQuery(edition, product, () => pickRandomPackFromBox(edition)) });
  }

  /** Create (null) or edit an edition in a dialog; the store refreshes the list on save. */
  protected openForm(edition: Edition | null): void {
    this.modal.open(EditionFormDialogComponent, { data: edition });
  }
}
