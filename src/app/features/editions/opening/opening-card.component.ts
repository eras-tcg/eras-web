import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { FoilKind } from '@data/editions/booster-rules';

const SPARKLES = 12;

/**
 * A card of an opening, dealt face down. `aura` (sr, sec) makes it glow in its rarity's color already face down;
 * `shake`: it trembles while the plain cards turn; `up`: it turns face up, a special one (with an aura) with a
 * bigger flourish: it rises, grows and bursts in its color. `foil` + `foiled`: in the foils' pass it turns all the
 * way around and comes back with its foil (holographic, or prismatic), throwing sparkles.
 */
@Component({
  selector: 'eras-opening-card',
  template: `
    <span class="face back" aria-hidden="true"></span>
    <span class="face front">
      @if (src(); as image) {
        <img [src]="image" [alt]="up() ? alt() : ''" />
      }
      @if (foiled()) {
        <span class="foil" aria-hidden="true"></span>
      }
    </span>
    @if (foiled()) {
      @for (s of sparkles; track $index) {
        <span class="sparkle" aria-hidden="true" [style.--angle]="s.angle + 'deg'" [style.--dist]="s.dist + 'px'" [style.--size]="s.size + 'px'"></span>
      }
    }
  `,
  styleUrl: './opening-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[class.up]': 'up()',
    '[class.shake]': 'shake()',
    '[class.big]': 'big()',
    '[class.foiled]': 'foiled()',
  },
})
export class OpeningCardComponent {
  readonly src = input<string | null>(null);
  readonly alt = input('');
  readonly aura = input<string | null>(null);
  readonly foil = input<FoilKind | null>(null);
  readonly up = input(false, { transform: booleanAttribute });
  readonly shake = input(false, { transform: booleanAttribute });
  /** Its foil showed (the second pass reached it). */
  readonly revealFoil = input(false, { transform: booleanAttribute });

  protected readonly big = computed(() => this.up() && !!this.aura());
  protected readonly foiled = computed(() => this.revealFoil() && !!this.foil());
  protected readonly classes = computed(() => [this.aura() ? `aura-${this.aura()}` : '', this.foil() ? `foil-${this.foil()}` : ''].join(' ').trim());
  protected readonly sparkles = Array.from({ length: SPARKLES }, (_, i) => ({
    angle: (360 / SPARKLES) * i + Math.random() * 20 - 10,
    dist: 50 + Math.random() * 60,
    size: 6 + Math.random() * 8,
  }));
}
