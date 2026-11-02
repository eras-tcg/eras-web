import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';

/**
 * A card of an opening, dealt face down. `aura` (sr, sec) makes it glow in its rarity's color already face down;
 * `shake`: it trembles while the plain cards turn; `up`: it turns face up, a special one (with an aura) with a
 * bigger flourish: it rises, grows and bursts in its color.
 */
@Component({
  selector: 'eras-opening-card',
  template: `
    <span class="face back" aria-hidden="true"></span>
    <span class="face front">
      @if (src(); as image) {
        <img [src]="image" [alt]="up() ? alt() : ''" />
      }
    </span>
  `,
  styleUrl: './opening-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'aura() ? "aura-" + aura() : ""',
    '[class.up]': 'up()',
    '[class.shake]': 'shake()',
    '[class.big]': 'big()',
  },
})
export class OpeningCardComponent {
  readonly src = input<string | null>(null);
  readonly alt = input('');
  readonly aura = input<string | null>(null);
  readonly up = input(false, { transform: booleanAttribute });
  readonly shake = input(false, { transform: booleanAttribute });

  protected readonly big = computed(() => this.up() && !!this.aura());
}
