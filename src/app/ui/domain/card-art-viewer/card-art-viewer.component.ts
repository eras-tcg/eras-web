import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IconComponent } from '../../primitives/icon/icon.component';
import { CardFaceComponent } from '../card-face/card-face.component';

/** How far the wheel zooms in and out (1 = as big as fits). */
const MAX_ZOOM = 4;
const MIN_ZOOM = 0.4;

export interface CardArtViewerData {
  src: string | null;
  alt: string;
  foil?: 'foil' | 'prism' | null;
  /** The card's shine image (the foil's cut comes from it) when its address says nothing of the card. */
  shine?: string | null;
  /** Without the glossy coat (an alternative art). */
  noGloss?: boolean;
  /**
   * Where the card has a glossy coat (rarity R and above): an image the card's size, white on the glossy parts (boxes,
   * strip, numbers' circles) and black on the texts that stay matte, used as a luminance mask for a band of light that
   * slides as the card turns. Null: no gloss.
   */
  gloss?: Promise<string | null> | null;
  /** Where the card's gold border is (cards that have one): a luminance mask for a warm metallic shine. Null: none. */
  gold?: Promise<string | null> | null;
}

/**
 * A card over the whole screen, on black, as big as it fits, with its finish: the one card drawing (eras-card-face)
 * live, so grabbing it turns it in 3D (all the way round to its back), lit from the front, with its thickness, and its
 * glossy coat and gold border drawn sharp at this size (the masks). Let go, it settles on the side in sight. The mouse
 * wheel zooms in and out toward the pointer. A tap anywhere, Esc or the close button takes it away. Opened with
 * ModalService, as wide and tall as the screen (maxWidth 100vw, maxHeight 100dvh).
 */
@Component({
  selector: 'eras-card-art-viewer',
  imports: [CardFaceComponent, IconComponent],
  template: `
    <div
      class="viewer"
      role="button"
      tabindex="-1"
      aria-label="Cerrar el arte"
      (click)="ref.close()"
      (wheel)="zoomBy($event)"
    >
      <div class="stage">
        <div
          class="zoom"
          [style.transform]="
            zoom().scale === 1
              ? null
              : 'translate(' + zoom().x + 'px, ' + zoom().y + 'px) scale(' + zoom().scale + ')'
          "
        >
          <eras-card-face
            class="art"
            [src]="data.src"
            [alt]="data.alt"
            [foil]="data.foil ?? null"
            [masks]="masks()"
            [shineSrc]="data.shine ?? null"
            [noGloss]="!!data.noGloss"
            eager
            live
          />
        </div>
      </div>
      <button type="button" class="close" aria-label="Cerrar" (click)="ref.close()">
        <eras-icon name="x" />
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
      inline-size: 100vw;
      block-size: 100dvh;
    }
    .viewer {
      display: grid;
      place-items: center;
      inline-size: 100%;
      block-size: 100%;
      padding: var(--space-4);
      background: rgb(0 0 0 / 72%);
      cursor: zoom-out;
      animation: fade 180ms ease-out both;
    }
    .stage {
      animation: grow 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .zoom {
      transition: transform 120ms ease-out;
    }
    .art {
      block-size: min(94dvh, calc((100vw - 2 * var(--space-4)) * 88 / 63));
      cursor: grab;
      --card-live-shadow: 0 1.5rem 4rem rgb(0 0 0 / 60%);
    }
    .close {
      position: fixed;
      inset-block-start: var(--space-4);
      inset-inline-end: var(--space-4);
      display: grid;
      place-items: center;
      inline-size: 2.75rem;
      block-size: 2.75rem;
      border: var(--border-width) solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes grow {
      from {
        opacity: 0;
        transform: scale(0.92);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .viewer,
      .stage {
        animation: none;
      }
      .zoom {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardArtViewerComponent {
  protected readonly data = inject<CardArtViewerData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);

  /** The glossy parts' mask and the gold border's, once they are drawn. */
  private readonly glossMask = signal<string | null>(null);
  private readonly goldMask = signal<string | null>(null);
  /** Both masks once either is drawn (until then the card shows none). */
  protected readonly masks = computed(() =>
    this.glossMask() || this.goldMask() ? { gloss: this.glossMask(), gold: this.goldMask() } : null,
  );

  /** The wheel's zoom: how big (1 = as big as fits) and how far moved (px) to keep the pointed spot under the pointer. */
  protected readonly zoom = signal({ scale: 1, x: 0, y: 0 });

  /** The wheel zooms in (up to MAX_ZOOM, around the spot under the pointer) and out (down to MIN_ZOOM, centered). */
  protected zoomBy(event: WheelEvent): void {
    event.preventDefault();
    const { scale, x, y } = this.zoom();
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale * Math.exp(-event.deltaY * 0.0015)));
    if (next <= 1) {
      this.zoom.set({ scale: next, x: 0, y: 0 });
      return;
    }
    // The pointer from the screen's middle (where the card's center rests): that spot stays put
    const ox = event.clientX - innerWidth / 2;
    const oy = event.clientY - innerHeight / 2;
    const k = next / scale;
    this.zoom.set({ scale: next, x: ox - (ox - x) * k, y: oy - (oy - y) * k });
  }

  constructor() {
    void this.data.gloss?.then((mask) => this.glossMask.set(mask));
    void this.data.gold?.then((mask) => this.goldMask.set(mask));
  }
}
