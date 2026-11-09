import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ButtonComponent } from '../../primitives/button/button.component';
import { IconComponent } from '../../primitives/icon/icon.component';
import { ModalComponent } from '../../surfaces/modal/modal.component';

export interface ImageFramerData {
  title: string;
  /** The image the player chose. */
  file: File;
  /** The size the result is drawn at (its shape is the frame's). */
  width: number;
  height: number;
  /** Seen through a circle (an icon); the result is still the whole square. */
  round?: boolean;
}

/** How the image lies in the frame: its center (in the result's pixels) and its scale on each axis. */
interface Placement {
  cx: number;
  cy: number;
  /** Over the scale that just covers the frame. */
  zoom: number;
  /** Each axis on its own, over the zoom. */
  kx: number;
  ky: number;
}

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 6;
const AXIS_MIN = 0.25;
const AXIS_MAX = 4;

/**
 * Frames an image before it is uploaded: the frame has the shape it will be kept in (icon, banner, playmat); the
 * image is dragged to show a part, made bigger or smaller (both axes or one) or forced to fill the frame exactly.
 * Closes with the framed image as a file, or nothing when cancelled.
 */
@Component({
  selector: 'eras-image-framer-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal [title]="data.title" size="lg" (closed)="ref.close()">
      <div class="framer">
        <div class="stage" [class.round]="data.round" [style.aspect-ratio]="data.width + ' / ' + data.height">
          <canvas
            #canvas
            [width]="data.width"
            [height]="data.height"
            (pointerdown)="grab($event)"
            (pointermove)="drag($event)"
            (pointerup)="release($event)"
            (pointercancel)="release($event)"
            (wheel)="wheel($event)"
          ></canvas>
        </div>

        <div class="fits" role="group" aria-label="Encuadre">
          <button erasButton variant="secondary" size="sm" type="button" (click)="cover()"><eras-icon name="maximize" />Cubrir</button>
          <button erasButton variant="secondary" size="sm" type="button" (click)="contain()"><eras-icon name="minimize" />Entera</button>
          <button erasButton variant="secondary" size="sm" type="button" (click)="stretch()"><eras-icon name="square-plus" />Estirar</button>
        </div>

        <div class="sliders">
          <label>
            <span>Tamaño</span>
            <input type="range" [min]="logZoomMin" [max]="logZoomMax" step="0.01" [value]="logZoom()" (input)="setZoom($any($event.target).valueAsNumber)" />
          </label>
          <label>
            <span>Ancho</span>
            <input type="range" [min]="logAxisMin" [max]="logAxisMax" step="0.01" [value]="logKx()" (input)="setAxis('kx', $any($event.target).valueAsNumber)" />
          </label>
          <label>
            <span>Alto</span>
            <input type="range" [min]="logAxisMin" [max]="logAxisMax" step="0.01" [value]="logKy()" (input)="setAxis('ky', $any($event.target).valueAsNumber)" />
          </label>
        </div>
      </div>
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cancelar</button>
        <button erasButton type="button" [disabled]="!image()" (click)="accept()">Guardar</button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .framer {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .stage {
      position: relative;
      align-self: center;
      inline-size: 100%;
      max-block-size: min(22rem, 45dvh);
      max-inline-size: 100%;
      overflow: hidden;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: repeating-conic-gradient(var(--color-surface-raised, #2a2a2a) 0 25%, var(--color-surface) 0 50%) 0 0 / 1rem 1rem;
    }
    /* A square frame (the icon) is not wider than the stage is high */
    .stage.round {
      inline-size: auto;
      block-size: min(18rem, 45dvh);
    }
    /* The circle the icon is seen through; the corners darkened */
    .stage.round::after {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      box-shadow: 0 0 0 999px rgb(0 0 0 / 55%);
      content: '';
      pointer-events: none;
    }
    canvas {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      cursor: grab;
      touch-action: none;
    }
    canvas:active {
      cursor: grabbing;
    }
    .fits {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-2);
    }
    .sliders {
      display: grid;
      gap: var(--space-2);
    }
    .sliders label {
      display: grid;
      grid-template-columns: 4.5rem 1fr;
      align-items: center;
      gap: var(--space-3);
      font-size: var(--font-size-sm);
    }
    .sliders input {
      inline-size: 100%;
      accent-color: var(--color-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageFramerDialogComponent implements OnDestroy {
  protected readonly data = inject<ImageFramerData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<File>>(DialogRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly image = signal<HTMLImageElement | null>(null);
  private readonly place = signal<Placement>({ cx: this.data.width / 2, cy: this.data.height / 2, zoom: 1, kx: 1, ky: 1 });
  private readonly objectUrl = URL.createObjectURL(this.data.file);
  private dragging: { id: number; x: number; y: number } | null = null;

  // The sliders move on a log scale (halving and doubling are the same distance)
  protected readonly logZoomMin = Math.log(ZOOM_MIN);
  protected readonly logZoomMax = Math.log(ZOOM_MAX);
  protected readonly logAxisMin = Math.log(AXIS_MIN);
  protected readonly logAxisMax = Math.log(AXIS_MAX);
  protected readonly logZoom = computed(() => Math.log(this.place().zoom));
  protected readonly logKx = computed(() => Math.log(this.place().kx));
  protected readonly logKy = computed(() => Math.log(this.place().ky));

  constructor() {
    const img = new Image();
    img.onload = () => this.image.set(img);
    img.src = this.objectUrl;
    afterNextRender(() => this.draw());
    effect(() => {
      this.place();
      if (this.image()) this.draw();
    });
  }

  ngOnDestroy(): void {
    URL.revokeObjectURL(this.objectUrl);
  }

  /** The scale at which the image just covers the frame. */
  private coverScale(img: HTMLImageElement): number {
    return Math.max(this.data.width / img.naturalWidth, this.data.height / img.naturalHeight);
  }

  private draw(): void {
    const img = this.image();
    const ctx = this.canvas().nativeElement.getContext('2d');
    if (!ctx) return;
    const { width, height } = this.data;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    if (!img) return;
    const p = this.place();
    const s = this.coverScale(img) * p.zoom;
    const w = img.naturalWidth * s * p.kx;
    const h = img.naturalHeight * s * p.ky;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, p.cx - w / 2, p.cy - h / 2, w, h);
  }

  protected cover(): void {
    this.place.set({ cx: this.data.width / 2, cy: this.data.height / 2, zoom: 1, kx: 1, ky: 1 });
  }

  protected contain(): void {
    const img = this.image();
    if (!img) return;
    const fit = Math.min(this.data.width / img.naturalWidth, this.data.height / img.naturalHeight);
    this.place.set({ cx: this.data.width / 2, cy: this.data.height / 2, zoom: fit / this.coverScale(img), kx: 1, ky: 1 });
  }

  /** The whole image exactly in the frame, each axis scaled as it needs. */
  protected stretch(): void {
    const img = this.image();
    if (!img) return;
    const s = this.coverScale(img);
    this.place.set({
      cx: this.data.width / 2,
      cy: this.data.height / 2,
      zoom: 1,
      kx: this.data.width / img.naturalWidth / s,
      ky: this.data.height / img.naturalHeight / s,
    });
  }

  protected setZoom(log: number): void {
    this.place.update((p) => ({ ...p, zoom: Math.exp(log) }));
  }

  protected setAxis(axis: 'kx' | 'ky', log: number): void {
    this.place.update((p) => ({ ...p, [axis]: Math.exp(log) }));
  }

  /** Canvas pixels per screen pixel. */
  private ratio(): number {
    const el = this.canvas().nativeElement;
    return this.data.width / (el.clientWidth || this.data.width);
  }

  protected grab(e: PointerEvent): void {
    if (this.dragging) return;
    this.dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  protected drag(e: PointerEvent): void {
    const d = this.dragging;
    if (!d || d.id !== e.pointerId) return;
    const r = this.ratio();
    const dx = (e.clientX - d.x) * r;
    const dy = (e.clientY - d.y) * r;
    d.x = e.clientX;
    d.y = e.clientY;
    this.place.update((p) => ({ ...p, cx: p.cx + dx, cy: p.cy + dy }));
  }

  protected release(e: PointerEvent): void {
    if (this.dragging?.id === e.pointerId) this.dragging = null;
  }

  protected wheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    this.place.update((p) => ({ ...p, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, p.zoom * factor)) }));
  }

  protected accept(): void {
    this.draw();
    this.canvas().nativeElement.toBlob(
      (blob) => {
        if (!blob) return;
        const name = this.data.file.name.replace(/\.[^.]*$/, '') + '.jpg';
        this.ref.close(new File([blob], name, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  }
}
