import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IconComponent } from '../../primitives/icon/icon.component';
import { CardFaceComponent } from '../card-face/card-face.component';

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
 * A card over the whole screen, as big as it fits, with its finish: the one card drawing (eras-card-face) live, so
 * grabbing it turns it in 3D, lit from the front, with its thickness, and its glossy coat and gold border drawn sharp at
 * this size (the masks). Let go, it settles back. A tap anywhere, Esc or the close button takes it away. Opened with
 * ModalService, as wide and tall as the screen (maxWidth 100vw, maxHeight 100dvh).
 */
@Component({
  selector: 'eras-card-art-viewer',
  imports: [CardFaceComponent, IconComponent],
  template: `
    <div class="viewer" role="button" tabindex="-1" aria-label="Cerrar el arte" (click)="ref.close()">
      <div class="stage">
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
      background: color-mix(in srgb, var(--color-hub-scrim) 88%, transparent);
      cursor: zoom-out;
      animation: fade 180ms ease-out both;
    }
    .stage {
      animation: grow 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
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

  constructor() {
    void this.data.gloss?.then((mask) => this.glossMask.set(mask));
    void this.data.gold?.then((mask) => this.goldMask.set(mask));
  }
}
