import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { EditDirective } from '@core/auth/edit.directive';
import { pickRandomPackFromBox } from '@data/editions/edition-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { BoxContent, ShopProduct, boxContents, openingQuery, shopProducts } from '@data/shop/shop-rules';
import { WalletStore } from '@data/shop/wallet.store';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { EditionCardsDialogComponent } from './edition-cards-dialog.component';
import { EditionFormDialogComponent } from './edition-form/edition-form-dialog.component';
import { PackOddsDialogComponent } from './pack-odds-dialog.component';
import { ShopCheckout } from './shop-checkout';
import { WalletBadgeComponent } from './wallet-badge.component';

/**
 * One edition in the shop (/editions/:editionId): its artwork on the right; on the left its odds and its cards
 * (dialogs, no page change) and the two things it sells: a pack, whose type comes at random with the box's
 * odds, and the booster box, with how many packs of each type it brings. One screen high.
 */
@Component({
  selector: 'eras-edition-shop-page',
  imports: [DecimalPipe, EditDirective, PageComponent, WalletBadgeComponent, EmptyStateComponent, ButtonComponent, IconComponent, SpinnerComponent],
  templateUrl: './edition-shop.page.html',
  styleUrl: './edition-shop.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionShopPage {
  readonly editionId = input.required<string>();

  protected readonly store = inject(EditionsStore);
  protected readonly wallet = inject(WalletStore);
  private readonly modal = inject(ModalService);
  private readonly checkout = inject(ShopCheckout);
  private readonly router = inject(Router);

  protected readonly edition = computed(() => this.store.editions().find((e) => e.editionId === this.editionId()) ?? null);
  private readonly products = computed(() => {
    const edition = this.edition();
    return edition ? shopProducts(edition) : [];
  });
  protected readonly pack = computed(() => this.products().find((p) => p.kind === 'pack') ?? null);
  protected readonly box = computed(() => this.products().find((p) => p.kind === 'box') ?? null);
  protected readonly contents = computed(() => {
    const edition = this.edition();
    return edition ? boxContents(edition) : [];
  });

  constructor() {
    void this.store.load();
    this.wallet.refresh();
  }

  protected range(row: BoxContent): string {
    return row.min === row.max ? String(row.min) : `${row.min}–${row.max}`;
  }

  protected openOdds(): void {
    this.modal.open(PackOddsDialogComponent, { data: this.edition() });
  }

  protected openCards(): void {
    this.modal.open(EditionCardsDialogComponent, { data: this.edition() });
  }

  protected openForm(): void {
    this.modal.open(EditionFormDialogComponent, { data: this.edition() });
  }

  protected async buy(product: ShopProduct): Promise<void> {
    const edition = this.edition();
    if (!edition || !(await this.checkout.purchase(edition, product))) return;
    void this.router.navigate(['/booster-result'], { queryParams: openingQuery(edition, product, () => pickRandomPackFromBox(edition)) });
  }
}
