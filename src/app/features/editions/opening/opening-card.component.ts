import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { FoilKind } from '@data/editions/booster-rules';

/** Sparkles a foil card throws, and a prismatic one (more, farther, in every color). */
const SPARKLES = 12;
const PRISM_SPARKLES = 24;

/**
 * A card of an opening, dealt face down. `aura` (sr, sec) makes it glow in its rarity's color already face down;
 * `shake`: it trembles while the plain cards turn; `up`: it turns face up, a special one (with an aura) with a
 * bigger flourish: it rises, grows and bursts in its color. `foil` + `foiled`: in the foils' pass it turns all the
 * way around and comes back with its foil (holographic), throwing sparkles. A prismatic one goes far beyond: it rises
 * higher and turns twice, rays of every color spin behind it, a ring of light spreads out, a band of the spectrum
 * sweeps across its face, it throws twice the sparkles in every color, and keeps a shifting rainbow glow.
 * `altSrc` + `revealAlt`: a copy with an alternative art, shown first with its usual art, turns into it: it rises, a
 * golden flash, the new art opening from its middle, a ring of light, golden sparkles, and the art's name (`altName`)
 * on a ribbon that stays.
 */
@Component({
  selector: 'eras-opening-card',
  template: `
    @if (prism()) {
      <!-- Behind it: rays of every color, and a ring of light spreading out -->
      <span class="prism-rays" aria-hidden="true"></span>
      <span class="prism-ring" aria-hidden="true"></span>
    }
    <span class="face back" aria-hidden="true"></span>
    <span class="face front">
      @if (src(); as image) {
        <img [src]="image" [alt]="up() ? alt() : ''" />
      }
      @if (foiled()) {
        <span class="foil" aria-hidden="true"></span>
      }
      @if (prism()) {
        <span class="spectrum" aria-hidden="true"></span>
      }
      @if (altSrc(); as alt) {
        <img class="alt-art" [src]="alt" alt="" />
      }
      @if (altShown()) {
        <span class="alt-flash" aria-hidden="true"></span>
        <span class="alt-tag">{{ altName() }}</span>
      }
    </span>
    @if (altShown()) {
      <span class="alt-ring" aria-hidden="true"></span>
      @for (s of sparkles; track $index) {
        <span class="alt-spark" aria-hidden="true" [style.--angle]="s.angle + 'deg'" [style.--dist]="s.dist * 1.3 + 'px'" [style.--size]="s.size + 'px'"></span>
      }
    }
    @if (foiled()) {
      @for (s of prism() ? sparkles : sparkles.slice(0, foilSparkles); track $index; let i = $index) {
        <span
          class="sparkle"
          aria-hidden="true"
          [style.--angle]="s.angle + 'deg'"
          [style.--dist]="(prism() ? s.dist * 1.6 : s.dist) + 'px'"
          [style.--size]="s.size + 'px'"
          [style.--hue]="(i * 360) / sparkles.length"
        ></span>
      }
    }
  `,
  styleUrls: ['./opening-card.component.scss', './opening-card.effects.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[class.up]': 'up()',
    '[class.shake]': 'shake()',
    '[class.big]': 'big()',
    '[class.foiled]': 'foiled()',
    '[class.alt-on]': 'altShown()',
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
  /** A copy with an alternative art: that art, what it is called, and whether it already turned into it. */
  readonly altSrc = input<string | null>(null);
  readonly altName = input<string | null>(null);
  readonly revealAlt = input(false, { transform: booleanAttribute });

  protected readonly big = computed(() => this.up() && !!this.aura());
  protected readonly foiled = computed(() => this.revealFoil() && !!this.foil());
  protected readonly prism = computed(() => this.foiled() && this.foil() === 'prism');
  protected readonly altShown = computed(() => this.revealAlt() && !!this.altSrc());
  protected readonly foilSparkles = SPARKLES;
  protected readonly classes = computed(() => [this.aura() ? `aura-${this.aura()}` : '', this.foil() ? `foil-${this.foil()}` : ''].join(' ').trim());
  protected readonly sparkles = Array.from({ length: PRISM_SPARKLES }, (_, i) => ({
    // The first SPARKLES all around (a foil card's), the rest between them
    angle: (360 / SPARKLES) * (i % SPARKLES) + (i >= SPARKLES ? 180 / SPARKLES : 0) + Math.random() * 20 - 10,
    dist: 50 + Math.random() * 60,
    size: 6 + Math.random() * 8,
  }));
}
