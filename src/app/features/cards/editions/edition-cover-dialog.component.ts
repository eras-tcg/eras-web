import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { CoverFrame } from '@data/editions/edition.model';
import { DEFAULT_COVER_FRAME } from '@data/editions/edition-rules';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { EditionTileComponent } from './edition-tile.component';

export interface EditionCoverData {
  code: string;
  name: string;
  /** The cover it has (or the one chosen in the form, not saved yet). */
  image: string | null;
  frame: CoverFrame | null;
}

export interface EditionCoverResult {
  /** A new image chosen here; null keeps the one it has. */
  file: File | null;
  frame: CoverFrame;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

/**
 * The edition's cover in its card-shaped tile, framed with the card editor's controls: vertical position on the left,
 * horizontal at the bottom, zoom on the right, a cross over the image (its dot centers it) and "Ajustar" (the whole
 * tile covered, no zoom). Closes with the image and framing chosen.
 */
@Component({
  selector: 'eras-edition-cover-dialog',
  imports: [ModalComponent, ButtonComponent, EditionTileComponent],
  template: `
    <eras-modal title="Portada" [subtitle]="data.code" (closed)="ref.close()">
      <div class="stage">
        <input
          class="slider vertical"
          type="range"
          aria-label="Posición vertical de la portada"
          min="0"
          max="100"
          step="0.5"
          [value]="frame().y"
          (input)="set({ y: $any($event.target).valueAsNumber })"
        />
        <div class="view">
          <eras-edition-tile [image]="image()" [frame]="frame()" [code]="data.code" [name]="data.name" />
          @if (image()) {
            <div class="cross">
              @for (n of nudges; track n.at) {
                <button
                  type="button"
                  [class]="'cross-' + n.at"
                  [attr.aria-label]="n.label"
                  (click)="n.at === 'mid' ? set({ x: 50, y: 50 }) : nudge(n.dx, n.dy)"
                >
                  {{ n.icon }}
                </button>
              }
            </div>
          }
        </div>
        <input
          class="slider zoom"
          type="range"
          aria-label="Zoom de la portada"
          [min]="zoomMin"
          [max]="zoomMax"
          step="0.01"
          [value]="frame().zoom"
          (input)="set({ zoom: $any($event.target).valueAsNumber })"
        />
        <input
          class="slider horizontal"
          type="range"
          aria-label="Posición horizontal de la portada"
          min="0"
          max="100"
          step="0.5"
          [value]="frame().x"
          (input)="set({ x: $any($event.target).valueAsNumber })"
        />
        <button erasButton class="fit" variant="secondary" size="sm" type="button" (click)="set({ x: 50, y: 50, zoom: 1 })">
          Ajustar
        </button>
      </div>
      <input #file type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="pick($event)" />
      <div modal-footer class="footer">
        <button erasButton variant="secondary" type="button" (click)="file.click()">Elegir imagen</button>
        <span class="spacer"></span>
        <button erasButton variant="ghost" type="button" (click)="ref.close()">Cancelar</button>
        <button erasButton type="button" [disabled]="!image()" (click)="done()">Listo</button>
      </div>
    </eras-modal>
  `,
  styles: `
    .stage {
      display: grid;
      grid-template-columns: 2.5rem minmax(0, 16rem) 2.5rem;
      grid-template-rows: auto 2rem;
      grid-template-areas: 'v view zoom' '. h fit';
      gap: var(--space-2);
      justify-content: center;
    }
    .view {
      grid-area: view;
      position: relative;
    }
    .slider {
      margin: 0;
    }
    .slider.vertical {
      grid-area: v;
      writing-mode: vertical-lr;
      /* Physical sizes: in vertical writing the logical ones swap. */
      height: 100%;
      width: 1.5rem;
      justify-self: center;
    }
    .slider.zoom {
      grid-area: zoom;
      writing-mode: vertical-lr;
      direction: rtl;
      height: 60%;
      width: 1.5rem;
      justify-self: center;
      align-self: center;
    }
    .slider.horizontal {
      grid-area: h;
      inline-size: 100%;
      align-self: center;
    }
    .fit {
      grid-area: fit;
      justify-self: end;
      align-self: center;
    }
    .cross {
      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 50%;
      z-index: 2;
      display: grid;
      grid-template-columns: repeat(3, 2rem);
      grid-template-rows: repeat(3, 2rem);
      grid-template-areas: '. up .' 'left mid right' '. down .';
      transform: translate(-50%, -50%);
    }
    .cross button {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full, 999px);
      background: color-mix(in srgb, var(--color-surface) 75%, transparent);
      color: var(--color-text);
      font-size: var(--font-size-sm);
      cursor: pointer;
    }
    .cross button:hover {
      background: var(--color-surface);
    }
    .cross-up {
      grid-area: up;
    }
    .cross-left {
      grid-area: left;
    }
    .cross-mid {
      grid-area: mid;
    }
    .cross-right {
      grid-area: right;
    }
    .cross-down {
      grid-area: down;
    }
    .footer {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      inline-size: 100%;
    }
    .spacer {
      flex: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionCoverDialogComponent {
  protected readonly data = inject<EditionCoverData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<EditionCoverResult>>(DialogRef);

  protected readonly zoomMin = ZOOM_MIN;
  protected readonly zoomMax = ZOOM_MAX;
  protected readonly frame = signal<CoverFrame>({ ...(this.data.frame ?? DEFAULT_COVER_FRAME) });
  protected readonly image = signal<string | null>(this.data.image);
  private file: File | null = null;
  private objectUrl: string | null = null;

  protected readonly nudges = [
    { at: 'up', icon: '↑', label: 'Mover la portada hacia arriba', dx: 0, dy: -2 },
    { at: 'left', icon: '←', label: 'Mover la portada a la izquierda', dx: -2, dy: 0 },
    { at: 'mid', icon: '•', label: 'Centrar la portada', dx: 0, dy: 0 },
    { at: 'right', icon: '→', label: 'Mover la portada a la derecha', dx: 2, dy: 0 },
    { at: 'down', icon: '↓', label: 'Mover la portada hacia abajo', dx: 0, dy: 2 },
  ];

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      // The form shows the chosen image with its own address
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    });
  }

  protected set(change: Partial<CoverFrame>): void {
    this.frame.update((f) => clampFrame({ ...f, ...change }));
  }

  /** The arrows move the image: "up" lifts it, showing more of its bottom. */
  protected nudge(dx: number, dy: number): void {
    this.frame.update((f) => clampFrame({ ...f, x: f.x - dx, y: f.y - dy }));
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.file = file;
    this.image.set(this.objectUrl);
    this.frame.set({ ...DEFAULT_COVER_FRAME });
  }

  protected done(): void {
    this.ref.close({ file: this.file, frame: this.frame() });
  }
}

function clampFrame(f: CoverFrame): CoverFrame {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return { x: clamp(f.x, 0, 100), y: clamp(f.y, 0, 100), zoom: clamp(f.zoom, ZOOM_MIN, ZOOM_MAX) };
}
