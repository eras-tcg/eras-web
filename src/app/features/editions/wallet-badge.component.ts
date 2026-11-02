import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WalletStore } from '@data/shop/wallet.store';
import { IconComponent } from '@ui/primitives/icon/icon.component';

/** The simulated gems left, for the shop's screens (their page actions). */
@Component({
  selector: 'eras-wallet-badge',
  imports: [DecimalPipe, IconComponent],
  template: `<eras-icon name="gem" /> {{ wallet.gems() | number: '1.0-0' : 'es' }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border: var(--border-width) solid var(--color-hub-accent);
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--color-hub-accent) 12%, var(--color-surface));
      font-weight: var(--font-weight-bold);
      font-variant-numeric: tabular-nums;
    }
    eras-icon {
      color: var(--color-hub-accent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', '[attr.aria-label]': 'wallet.gems() + " gemas"' },
})
export class WalletBadgeComponent {
  protected readonly wallet = inject(WalletStore);
}
