import { Injectable, inject } from '@angular/core';
import { Edition } from '@data/editions/edition.model';
import { ShopProduct } from '@data/shop/shop-rules';
import { WalletStore } from '@data/shop/wallet.store';
import { ModalService } from '@ui/surfaces/modal/modal.service';

/** Name of a purchase, as the opening checks it (WalletStore tickets). */
export const purchaseTicket = (edition: Edition, product: ShopProduct) => `${edition.editionId}|${product.kind}`;

/** Buying in the Editions shop: asks for confirmation with the price and what is left, then pays. */
@Injectable({ providedIn: 'root' })
export class ShopCheckout {
  private readonly wallet = inject(WalletStore);
  private readonly modal = inject(ModalService);

  /** True when it was confirmed and paid. */
  async purchase(edition: Edition, product: ShopProduct): Promise<boolean> {
    const left = this.wallet.gems() - product.price;
    if (left < 0) return false;
    const ok = await this.modal.confirm({
      title: 'Confirmar compra',
      message: `${product.name} de ${edition.editionName ?? edition.editionId} por ${product.price} gemas. Te quedarán ${left} gemas.`,
      confirmLabel: 'Comprar',
    });
    return ok && this.wallet.buy(product.price, purchaseTicket(edition, product));
  }
}
