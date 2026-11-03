import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '../../primitives/icon/icon.component';
import { CardImageComponent } from '../card-image/card-image.component';

export interface CardArtViewerData {
  src: string | null;
  alt: string;
  foil?: 'foil' | 'prism' | null;
}

/**
 * A card's art over the whole screen, as big as it fits, with its finish. A click anywhere, Esc or the close button
 * takes it away. Opened with ModalService, as wide and tall as the screen (maxWidth 100vw, maxHeight 100dvh).
 */
@Component({
  selector: 'eras-card-art-viewer',
  imports: [CardImageComponent, IconComponent],
  template: `
    <div class="viewer" role="button" tabindex="-1" aria-label="Cerrar el arte" (click)="ref.close()">
      <eras-card-image class="art" [src]="data.src" [alt]="data.alt" [foil]="data.foil ?? null" eager />
      <button type="button" class="close" aria-label="Cerrar" (click)="ref.close()"><eras-icon name="x" /></button>
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
    .art {
      block-size: min(94dvh, calc((100vw - 2 * var(--space-4)) * 88 / 63));
      border-radius: var(--radius-lg);
      box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 60%);
      animation: grow 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
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
      .art {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardArtViewerComponent {
  protected readonly data = inject<CardArtViewerData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
}
