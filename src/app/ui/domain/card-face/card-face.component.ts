import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, computed, inject, input, signal } from '@angular/core';
import { DRAG_START, Tilt, cardEdge, facingTilt, lightOf, restingTurn, spinFromDrag } from '../card-art-viewer/card-tilt';
import { CARD_SHINE } from '../card-image/card-shine';

/**
 * The one drawing of a card, wherever it shows (web pages and the game table): its picture at the printed proportions
 * (63×88) with corners in proportion to its size, or its back (`hidden`), or its name when it has no picture. Over the
 * picture, everything that is part of the card itself:
 * - its still shine (the glossy coat of rarity R and above and the gold border's metal, from the PNG drawn with its
 *   render, found from `src` or given as `shineSrc`; `noShine` or a `.no-card-shine` ancestor leaves it out);
 * - the owner's foil copy (`foil`: holographic, or starlight for `prism`), over all the card but its glossy parts and
 *   its effect box;
 * - `peeked`: a hidden card shown anyway, its back still over the lower right corner;
 * - `turned`: the picture upside down (the rival's card across the table);
 * - `live`: grabbed and dragged it turns in 3D, lit from a lamp in front (a glare, the far side in shadow, a rim lit on
 *   the lamp's side, the gloss band and the gold's glint moving), with its thickness and its back behind, above what is
 *   around it. Across it spins all the way round; let go, it settles flat on the side nearer to the eye (face or back).
 *   A drag is not a click. `--card-live-shadow` gives it a shadow behind (the 3D viewer's);
 * - `masks`: where it shines drawn at the card's size (the 3D viewer's, sharper than the shine PNG), instead of it.
 * Sized by its parent (width, or height with the ratio); what goes around a card (badges, counts, frames) belongs to the
 * components that wrap it (eras-card-image, eras-game-card…).
 */
@Component({
  selector: 'eras-card-face',
  template: `
    @if (live()) {
      <!-- The card's thickness: thin sheets behind its face, the middle ones lighter (a slightly round edge) -->
      @for (e of edge; track e.z) {
        <span class="edge" [class.back]="$last" [style.transform]="'translateZ(' + e.z + 'px)'" [style.--edge-lit]="e.lit"></span>
      }
      <!-- Its back, behind its thickness and facing the other way: in sight once it is turned round -->
      <span class="reverse" [style.transform]="'translateZ(' + backZ + 'px) rotateY(180deg)'" aria-hidden="true"></span>
    }
    <!-- The face, flat and cut to the card's outline: its blended layers mix with its own picture -->
    <div class="face">
      @if (hidden()) {
        <span class="back" aria-hidden="true"></span>
      } @else if (src()) {
        <img [src]="src()" [alt]="alt()" [attr.loading]="eager() ? null : 'lazy'" decoding="async" draggable="false" />
        @if (glossUrl(); as url) {
          <span class="gloss" [class.full]="!!masks()" [style.--card-shine]="'url(&quot;' + url + '&quot;)'" aria-hidden="true"></span>
        }
        @if (goldUrl(); as url) {
          <span class="gold" [class.full]="!!masks()" [style.--card-shine]="'url(&quot;' + url + '&quot;)'" aria-hidden="true"></span>
        }
        @if (foil(); as kind) {
          <!-- It covers all the card but its glossy parts and its effect box (from its shine image) -->
          <span
            class="foil"
            [class.prism]="kind === 'prism'"
            [class.cut]="!!shineAll()"
            [style.--card-shine]="shineAll() ? 'url(&quot;' + shineAll() + '&quot;)' : null"
            aria-hidden="true"
          ></span>
        }
        @if (peeked()) {
          <span class="back peek" aria-hidden="true"></span>
        }
        @if (live()) {
          <span class="light" aria-hidden="true"></span>
          <span class="rim" aria-hidden="true"></span>
        }
      } @else {
        <span class="missing">{{ name() || alt() }}</span>
      }
    </div>
  `,
  host: {
    '[class.live]': 'live()',
    '[class.held]': 'held()',
    '[class.turned]': 'turned()',
    '[style.transform]': 'transform()',
    '[style.--light-x.%]': 'light()?.x',
    '[style.--light-y.%]': 'light()?.y',
    '[style.--glare]': 'light()?.glare',
    '[style.--shade]': 'light()?.shade',
    '[style.--shade-angle.deg]': 'shadeAngle()',
    '[style.--rim-angle.deg]': 'shadeAngle() === null ? null : shadeAngle()! + 180',
    '[style.--gloss-x.%]': 'light()?.glossX',
    '[style.--gloss-y.%]': 'light()?.glossY',
    '[style.--gloss]': 'light()?.gloss',
    '[style.--metal.px]': 'metal()',
    '(pointerdown)': 'grab($event)',
    '(pointermove)': 'drag($event)',
    '(pointerup)': 'release($event)',
    '(pointercancel)': 'release($event)',
  },
  styles: `
    @use 'mixins/foil';
    @use 'mixins/card-shine';

    :host {
      position: relative;
      display: block;
      aspect-ratio: 63 / 88;
      border-radius: var(--radius-card);
    }
    .face {
      position: relative;
      inline-size: 100%;
      block-size: 100%;
      overflow: hidden;
      // Its own blending group: the foil's soft-light mixes with the card's picture even inside the leaning table's
      // 3D plane (there, without it, Chrome showed the foil's raw colors over the card)
      isolation: isolate;
      border-radius: inherit;
      background: var(--color-surface-muted);
    }
    :host(.turned) .face { transform: rotate(180deg); }
    img, .back { display: block; inline-size: 100%; block-size: 100%; border-radius: inherit; object-fit: cover; }
    .back {
      // The card back art, with its own black edge: the same in both themes, like a physical card
      background: var(--color-card-back);
    }
    // Past position t of a "to bottom right" gradient lies 2·(1−t)² of the card: fading from 52% to 72% leaves about
    // 70% of the card in sight and its back over the last 30%, the lower right corner
    .peek {
      position: absolute;
      inset: 0;
      pointer-events: none;
      mask-image: linear-gradient(to bottom right, transparent 52%, #000 72%);
    }
    .missing {
      display: grid;
      place-items: center;
      block-size: 100%;
      padding: 0.25rem;
      border: 1px dashed var(--color-border);
      border-radius: inherit;
      color: var(--color-text-subtle);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      text-align: center;
      overflow-wrap: anywhere;
    }
    .gloss { @include card-shine.gloss; }
    .gold { @include card-shine.gold; }
    // Masks drawn at the card's size: the whole image is the mask
    .full { mask-size: 100% 100%; -webkit-mask-size: 100% 100%; mask-position: 0 0; -webkit-mask-position: 0 0; }
    // A page's preference (the game table's): no still shine on its cards (lighter on slow devices)
    :host-context(.no-card-shine) :is(.gloss, .gold) { display: none; }
    .foil {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      border-radius: inherit;
      pointer-events: none;
    }
    // The wrapper blends with the card (see foil.rainbow)
    .foil:not(.prism) { mix-blend-mode: soft-light; }
    .foil:not(.prism)::after { @include foil.rainbow(normal); }
    .foil.prism { @include foil.scaled; }
    .foil.prism::before { @include foil.glitter-dots; }
    .foil.prism::after { @include foil.glitter-light; }
    .foil.cut { @include card-shine.foil-cut; }

    /* A live card: in 3D, its face in front of its thickness; it turns while held and settles back when let go */
    :host(.live) {
      touch-action: none;
      user-select: none;
      transform-style: preserve-3d;
      transition: transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    :host(.live.held) { z-index: 10; cursor: grabbing; transition: none; }
    :host(.live) .face { isolation: isolate; transform: translateZ(0); transform-style: flat; backface-visibility: hidden; }
    .reverse {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: var(--color-card-back);
      backface-visibility: hidden;
      pointer-events: none;
    }
    .edge {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: color-mix(in srgb, #3a3a3a calc(var(--edge-lit, 0) * 100%), #0c0c0c);
      pointer-events: none;
    }
    .edge.back { box-shadow: var(--card-live-shadow, none); }
    .light {
      position: absolute;
      inset: 0;
      z-index: 1;
      border-radius: inherit;
      background:
        radial-gradient(
          circle at var(--light-x, 50%) var(--light-y, 50%),
          rgb(255 255 255 / var(--glare, 0.2)) 0%,
          rgb(255 255 255 / 0%) 55%
        ),
        linear-gradient(var(--shade-angle, 0deg), rgb(0 0 0 / 0%) 40%, rgb(0 0 0 / var(--shade, 0)) 100%);
      mix-blend-mode: soft-light;
      pointer-events: none;
    }
    /* A thin ring along the face's edge, lit from the lamp's side: the edge reads as slightly rounded */
    .rim {
      position: absolute;
      inset: 0;
      z-index: 2;
      border: 1.5px solid transparent;
      border-radius: inherit;
      background: linear-gradient(
          var(--rim-angle, 180deg),
          rgb(255 255 255 / 55%),
          rgb(255 255 255 / 0%) 35%,
          rgb(0 0 0 / 0%) 65%,
          rgb(0 0 0 / 50%)
        )
        border-box;
      mask:
        linear-gradient(#000 0 0) padding-box exclude,
        linear-gradient(#000 0 0) border-box;
      -webkit-mask:
        linear-gradient(#000 0 0) padding-box,
        linear-gradient(#000 0 0) border-box;
      -webkit-mask-composite: xor;
      mix-blend-mode: soft-light;
      pointer-events: none;
    }
    @media (prefers-reduced-motion: reduce) {
      :host(.live) { transition: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardFaceComponent {
  readonly src = input<string | null>(null);
  readonly alt = input('');
  /** Shown instead of the picture when there is none (a test card). */
  readonly name = input<string | null>(null);
  /** Face down: its back. */
  readonly hidden = input(false, { transform: booleanAttribute });
  /** A card hidden from this player shown anyway ("Mostrar cartas ocultas"): its back covers a corner. */
  readonly peeked = input(false, { transform: booleanAttribute });
  readonly foil = input<'foil' | 'prism' | null>(null);
  /** The card's shine image when the app cannot find it from `src` (see card-shine.ts). */
  readonly shineSrc = input<string | null>(null);
  /** Without the still shine (the 3D viewer draws its own, moving). */
  readonly noShine = input(false, { transform: booleanAttribute });
  /** Without the glossy coat only (an alternative art: its texts may sit otherwise; its gold and foil cut are the card's). */
  readonly noGloss = input(false, { transform: booleanAttribute });
  /** Loads its picture at once (otherwise when it comes near the screen). */
  readonly eager = input(false, { transform: booleanAttribute });
  /** The picture upside down (the rival's card across the table). */
  readonly turned = input(false, { transform: booleanAttribute });
  /** Grabbed and dragged, it turns in 3D. */
  readonly live = input(false, { transform: booleanAttribute });
  /** Where it shines, drawn at the card's size (luminance masks), instead of the shine PNG; null parts shine none. */
  readonly masks = input<{ gloss: string | null; gold: string | null } | null>(null);

  private readonly shineOf = inject(CARD_SHINE);
  protected readonly shine = computed(() => (this.noShine() ? null : (this.shineSrc() ?? this.shineOf(this.src()))));
  /** The card's shine image, even where the still shine is left out (the foil's cut comes from it too). */
  protected readonly shineAll = computed(() => this.shineSrc() ?? this.shineOf(this.src()));
  protected readonly glossUrl = computed(() => (this.noGloss() ? null : this.masks() ? this.masks()!.gloss : this.shine()));
  protected readonly goldUrl = computed(() => (this.masks() ? this.masks()!.gold : this.shine()));

  /** The sheets of a live card's thickness, behind its face. */
  protected readonly edge = cardEdge();
  /** How far behind the face its back sits (past its thickness). */
  protected readonly backZ = Math.min(...this.edge.map((e) => e.z)) - 0.5;
  private readonly tilt = signal<Tilt>({ rx: 0, ry: 0 });
  protected readonly held = signal(false);
  /** The side in sight's own lean, which lights it. */
  private readonly facing = computed(() => facingTilt(this.tilt()));
  protected readonly light = computed(() => (this.live() ? lightOf(this.facing()) : null));
  protected readonly transform = computed(() => {
    const { rx, ry } = this.tilt();
    return this.live() && (rx || ry) ? `perspective(1600px) rotateX(${rx}deg) rotateY(${ry}deg)` : null;
  });
  /** The shadow falls toward the side turned away (rx > 0 sends the top away: 0deg; ry > 0 the right side: 90deg). */
  protected readonly shadeAngle = computed(() => {
    if (!this.live()) return null;
    const { rx, ry } = this.facing();
    return rx || ry ? (Math.atan2(ry, rx) * 180) / Math.PI : 0;
  });
  /** How far the gold's bands slide (px): a polished metal's reflections run fast as it turns. */
  protected readonly metal = computed(() => (this.live() ? this.facing().ry * 9 - this.facing().rx * 6 : null));

  /** The press in progress: where it started, the card's size, and whether it has become a drag. */
  private press: { x: number; y: number; w: number; h: number; moved: boolean; from: Tilt } | null = null;

  /** A drag just ended: the click that follows it is not the card's. */
  private dragged = false;

  constructor() {
    // A drag ends with a click on the card: it is swallowed before the card's own click handlers (capture runs first)
    inject(ElementRef<HTMLElement>).nativeElement.addEventListener(
      'click',
      (event: Event) => {
        if (!this.dragged) return;
        this.dragged = false;
        event.stopImmediatePropagation();
        event.preventDefault();
      },
      { capture: true },
    );
  }

  protected grab(event: PointerEvent): void {
    if (!this.live() || event.button !== 0) return;
    const el = event.currentTarget as HTMLElement;
    const box = el.getBoundingClientRect();
    el.setPointerCapture(event.pointerId);
    this.dragged = false;
    this.press = { x: event.clientX, y: event.clientY, w: box.width, h: box.height, moved: false, from: this.tilt() };
  }

  protected drag(event: PointerEvent): void {
    const p = this.press;
    if (!p) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < DRAG_START) return;
    p.moved = true;
    this.held.set(true);
    this.tilt.set(spinFromDrag(p.from, dx, dy, p.w, p.h));
  }

  /** Let go: the card settles flat, on the side nearer to the eye. */
  protected release(event: PointerEvent): void {
    const p = this.press;
    if (!p) return;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.press = null;
    this.dragged = p.moved;
    this.held.set(false);
    this.tilt.set(restingTurn(this.tilt()));
  }
}
