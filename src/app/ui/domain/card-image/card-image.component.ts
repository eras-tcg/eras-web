import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { CardFaceComponent } from '../card-face/card-face.component';

/**
 * A card on the web pages: the card itself (eras-card-face: picture, still shine, `foil`, `live` 3D turn…) and an optional
 * small `badge` at the top (it leaves the printed name visible). Sized by its parent (width, or height with the ratio).
 */
@Component({
  selector: 'eras-card-image',
  imports: [CardFaceComponent],
  template: `
    <eras-card-face
      [src]="src()"
      [alt]="alt()"
      [eager]="eager()"
      [foil]="foil()"
      [shineSrc]="shineSrc()"
      [noShine]="noShine()"
      [noGloss]="noGloss()"
      [live]="live()"
    />
    @if (badge()) {
      <span class="badge" [class.info]="badgeTone() === 'info'">{{ badge() }}</span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      aspect-ratio: 63 / 88;
      border-radius: var(--radius-card);
    }
    eras-card-face { position: absolute; inset: 0; }
    .badge {
      position: absolute;
      z-index: 2;
      inset-block-start: 12%;
      inset-inline-start: 50%;
      max-inline-size: 90%;
      padding: 0.1rem 0.4rem;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-danger) 75%, transparent);
      color: #fff;
      font-size: 0.625rem;
      font-weight: var(--font-weight-bold);
      line-height: 1.4;
      white-space: nowrap;
      text-overflow: ellipsis;
      transform: translateX(-50%);
      pointer-events: none;
    }
    .badge.info { background: color-mix(in srgb, var(--color-info) 75%, transparent); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardImageComponent {
  readonly src = input<string | null>(null);
  readonly alt = input('');
  readonly badge = input<string | null>(null);
  /** danger (red: missing data) or info (blue). */
  readonly badgeTone = input<'danger' | 'info'>('danger');
  readonly eager = input(false, { transform: booleanAttribute });
  readonly foil = input<'foil' | 'prism' | null>(null);
  /** The card's shine image when the app cannot find it from `src` (see card-shine.ts). */
  readonly shineSrc = input<string | null>(null);
  /** Without the still shine (the 3D viewer draws its own, moving). */
  readonly noShine = input(false, { transform: booleanAttribute });
  /** Without the glossy coat only (an alternative art, see eras-card-face). */
  readonly noGloss = input(false, { transform: booleanAttribute });
  /** Grabbed and dragged, it turns in 3D (see eras-card-face). */
  readonly live = input(false, { transform: booleanAttribute });
}
