import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { PackTier } from '@data/editions/booster-rules';

/**
 * A pack of the shop's opening, card-shaped with the edition's artwork (`art`, a CSS url()). Its `tier` shows as
 * an aura: none for the plain ones, an amber edge for SR, a pink halo for SEC, a turning ring of every color for
 * GOD. `dealt`: it lands on the table (its parent staggers them with animation-delay). `upgraded`: it will go up a
 * rarity, so it shakes; `lifted`: it does, with a full horizontal turn. `big` and `box` for the one on sale.
 */
@Component({
  selector: 'eras-opening-pack',
  template: `
    @if (label()) {
      <span class="label">{{ label() }}</span>
    }
  `,
  styleUrl: './opening-pack.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"tier-" + tier()',
    '[class.dealt]': 'dealt()',
    '[class.upgraded]': 'upgraded()',
    '[class.lifted]': 'lifted()',
    '[class.big]': 'big()',
    '[class.box]': 'box()',
    '[style.--art]': 'art()',
    'aria-hidden': 'true',
  },
})
export class OpeningPackComponent {
  readonly art = input<string | null>(null);
  readonly tier = input<PackTier>('none');
  readonly label = input<string | null>(null);
  readonly dealt = input(false, { transform: booleanAttribute });
  readonly upgraded = input(false, { transform: booleanAttribute });
  readonly lifted = input(false, { transform: booleanAttribute });
  readonly big = input(false, { transform: booleanAttribute });
  readonly box = input(false, { transform: booleanAttribute });
}
