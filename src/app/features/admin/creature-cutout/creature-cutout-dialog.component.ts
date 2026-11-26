import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { ApiConfig } from '@core/http/api-config';
import { CardMeta } from '@data/cards/card.model';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { CreatureSummonComponent } from '@ui/domain/creature-summon/creature-summon.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { firstValueFrom } from 'rxjs';
import { Mask, combine, dab, emptyMask, fadedAtEdges, maskFromCutout, placeOf, shownBox, withPlace } from './cutout-mask';
import { CutoutSam } from './cutout-sam';

export interface CreatureCutoutData {
  metaId: string;
  name: string;
  strength: number;
  identity: string;
  /** Its cut-out saved now (its address), or null: the editor starts from it. */
  creature: string | null;
}

type Tool = 'add' | 'remove' | 'paint' | 'erase';

/** The illustration is read at most this big (its longer side), as the batch tool does. */
const MAX_SIDE = 1100;
const UNDO_STEPS = 30;

/**
 * The editor of a card's creature cut-out (manage_cards): the illustration, where a click finds a whole part (Segment
 * Anything, in the browser) to add to the creature or take out of it, and a brush to touch it up. Its summon can be
 * seen before saving; saved, the figure fades where it meets the picture's edge and is cropped round it. Closes with
 * the card's metadata after a change.
 */
@Component({
  selector: 'eras-creature-cutout-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent, AlertComponent, CreatureSummonComponent],
  template: `
    <section class="editor" aria-label="Recorte de la criatura">
      <header class="head">
        <h2>Recorte de {{ data.name }}</h2>
        <button erasButton variant="ghost" size="sm" type="button" aria-label="Cerrar" (click)="ref.close()"><eras-icon name="x" /></button>
      </header>
      <div class="tools" role="toolbar" aria-label="Herramientas">
        <div class="group" role="radiogroup" aria-label="Herramienta">
          @for (t of tools; track t.id) {
            <button erasButton size="sm" type="button" role="radio" [variant]="tool() === t.id ? 'primary' : 'secondary'" [attr.aria-checked]="tool() === t.id" [disabled]="!t.brush && !samReady()" (click)="tool.set(t.id)">
              {{ t.label }}
            </button>
          }
        </div>
        @if (tool() === 'paint' || tool() === 'erase') {
          <label class="size">
            Tamaño
            <input type="range" min="2" max="80" [value]="brush()" (input)="brush.set(+$any($event.target).value)" />
          </label>
        }
        <div class="group">
          <button erasButton variant="ghost" size="sm" type="button" [disabled]="!undoable()" (click)="undo()">Deshacer</button>
          <button erasButton variant="ghost" size="sm" type="button" [disabled]="!mask" (click)="clear()">Limpiar</button>
        </div>
      </div>
      @if (status(); as s) {
        <p class="status" aria-live="polite">{{ s }}</p>
      }
      @if (error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      <div class="canvas-box">
        <canvas
          #canvas
          [class.brush]="tool() === 'paint' || tool() === 'erase'"
          (pointerdown)="down($event)"
          (pointermove)="move($event)"
          (pointerup)="up()"
          (pointercancel)="up()"
          (contextmenu)="$event.preventDefault()"
        ></canvas>
      </div>
      <p class="hint">
        Agregar o Quitar parte: un clic sobre ella. Pincel y Borrador: arrastrar. Lo que queda fuera se ve en magenta.
      </p>
      <footer class="actions">
        @if (data.creature) {
          <button erasButton variant="danger" size="sm" type="button" [disabled]="busy()" (click)="removeCut()">Quitar recorte</button>
        }
        <span class="spacer"></span>
        <button erasButton variant="secondary" size="sm" type="button" [disabled]="busy() || !mask" (click)="preview()"><eras-icon name="play" /> Ver animación</button>
        <button erasButton size="sm" type="button" [disabled]="busy() || !mask" (click)="save()">Guardar</button>
      </footer>
    </section>
    @if (previewUrl(); as url) {
      <eras-creature-summon [creature]="url" [name]="data.name" [strength]="data.strength" [identity]="data.identity" (done)="endPreview()" />
    }
  `,
  styles: `
    .editor {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
      inline-size: min(96vw, 1100px);
      max-block-size: 94dvh;
      grid-template-rows: auto auto auto minmax(0, 1fr) auto auto;
      background: var(--color-surface);
      color: var(--color-text);
      border-radius: var(--radius-lg, 12px);
    }
    .head,
    .tools,
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }
    .head h2 {
      flex: 1;
      margin: 0;
      font-size: var(--font-size-lg, 1.125rem);
    }
    .group {
      display: flex;
      gap: var(--space-1);
    }
    .size {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .status,
    .hint {
      margin: 0;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm, 0.875rem);
    }
    .canvas-box {
      min-block-size: 0;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #111;
      border-radius: var(--radius-md, 8px);
    }
    canvas {
      max-inline-size: 100%;
      max-block-size: 62dvh;
      cursor: crosshair;
      touch-action: none;
    }
    canvas.brush {
      cursor: cell;
    }
    .spacer {
      flex: 1;
    }
  `,
})
export class CreatureCutoutDialogComponent {
  protected readonly data = inject<CreatureCutoutData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<CardMeta | null>>(DialogRef);
  private readonly admin = inject(CardsAdminApi);
  private readonly api = inject(ApiConfig);

  protected readonly tools: { id: Tool; label: string; brush: boolean }[] = [
    { id: 'add', label: 'Agregar parte', brush: false },
    { id: 'remove', label: 'Quitar parte', brush: false },
    { id: 'paint', label: 'Pincel', brush: true },
    { id: 'erase', label: 'Borrador', brush: true },
  ];
  protected readonly tool = signal<Tool>('add');
  protected readonly brush = signal(14);
  protected readonly samReady = signal(false);
  protected readonly status = signal<string | null>('Cargando la ilustración…');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly undoable = signal(false);
  protected readonly previewUrl = signal<string | null>(null);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  protected mask: Mask | null = null;
  private art: ImageData | null = null;
  private artUrl: string | null = null;
  private sam: CutoutSam | null = null;
  private history: Uint8ClampedArray[] = [];
  private stroke: { x: number; y: number } | null = null;
  private frame = 0;

  constructor() {
    afterNextRender(() => void this.start());
    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(this.frame);
      if (this.artUrl) URL.revokeObjectURL(this.artUrl);
      this.endPreview();
    });
  }

  private async start(): Promise<void> {
    // What to say once it is ready, about the cut-out it started from
    let note: string | null = null;
    try {
      const blob = await firstValueFrom(this.admin.art(this.data.metaId));
      const bitmap = await createImageBitmap(blob);
      const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * k);
      const h = Math.round(bitmap.height * k);
      const canvas = this.canvas().nativeElement;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, w, h);
      this.art = ctx.getImageData(0, 0, w, h);
      this.mask = emptyMask(w, h);
      // SAM reads the illustration as it is shown (its size, so its parts match the mask)
      const scaled = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
      this.artUrl = scaled ? URL.createObjectURL(scaled) : null;
      if (this.data.creature) note = await this.resume(this.data.creature, w, h);
      this.draw();
    } catch (e) {
      this.status.set(null);
      this.error.set(apiErrorMessage(e, 'La carta no tiene su ilustración guardada (se sube desde el editor de cartas)'));
      return;
    }
    try {
      this.status.set('Cargando el modelo de recorte (la primera vez descarga unos 15 MB)…');
      this.sam = await CutoutSam.load((p) => this.status.set(`Cargando el modelo de recorte… ${Math.round(p * 100)} %`));
      this.status.set('Leyendo la ilustración…');
      if (this.artUrl) await this.sam.read(this.artUrl);
      this.samReady.set(true);
      this.status.set(note);
    } catch {
      // The brush still works without it
      this.tool.set('paint');
      this.status.set('No se pudo cargar el modelo de recorte: solo el pincel está disponible.');
    }
  }

  /** The cut-out saved before, put back on the illustration to go on from it (if it says where it was cropped from). */
  private async resume(url: string, w: number, h: number): Promise<string | null> {
    try {
      const bytes = new Uint8Array(await (await fetch(this.api.url(url))).arrayBuffer());
      const place = placeOf(bytes);
      if (!place) return 'El recorte guardado no dice de qué parte de la ilustración salió: este empieza desde cero.';
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const rgba = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const alpha = new Uint8ClampedArray(bitmap.width * bitmap.height);
      for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
      this.mask = maskFromCutout(alpha, bitmap.width, bitmap.height, place, w, h);
      return null;
    } catch {
      return 'No se pudo abrir el recorte guardado: este empieza desde cero.';
    }
  }

  protected async down(event: PointerEvent): Promise<void> {
    if (!this.mask || this.busy()) return;
    const at = this.pointAt(event);
    const tool = this.tool();
    if (tool === 'paint' || tool === 'erase') {
      this.remember();
      this.stroke = at;
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      dab(this.mask, at.x, at.y, this.brush(), tool === 'paint');
      this.scheduleDraw();
      return;
    }
    if (!this.sam || !this.samReady()) return;
    this.busy.set(true);
    try {
      const part = await this.sam.part([{ x: at.x, y: at.y, inside: true }]);
      this.remember();
      this.mask = combine(this.mask, part, tool === 'add');
      this.draw();
    } catch {
      this.error.set('No se pudo encontrar esa parte');
    } finally {
      this.busy.set(false);
    }
  }

  protected move(event: PointerEvent): void {
    if (!this.stroke || !this.mask) return;
    const at = this.pointAt(event);
    const add = this.tool() === 'paint';
    const r = this.brush();
    // Dabs along the way, close enough to make a line
    const steps = Math.max(1, Math.ceil(Math.hypot(at.x - this.stroke.x, at.y - this.stroke.y) / (r / 3)));
    for (let i = 1; i <= steps; i++) {
      dab(this.mask, this.stroke.x + ((at.x - this.stroke.x) * i) / steps, this.stroke.y + ((at.y - this.stroke.y) * i) / steps, r, add);
    }
    this.stroke = at;
    this.scheduleDraw();
  }

  protected up(): void {
    this.stroke = null;
  }

  protected undo(): void {
    const last = this.history.pop();
    if (last && this.mask) this.mask = { ...this.mask, data: last };
    this.undoable.set(this.history.length > 0);
    this.draw();
  }

  protected clear(): void {
    if (!this.mask) return;
    this.remember();
    this.mask = emptyMask(this.mask.width, this.mask.height);
    this.draw();
  }

  protected async preview(): Promise<void> {
    const png = await this.cutout();
    if (!png) return;
    this.endPreview();
    this.previewUrl.set(URL.createObjectURL(png));
  }

  protected endPreview(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }

  protected async save(): Promise<void> {
    const png = await this.cutout();
    if (!png) return;
    await this.change(() => firstValueFrom(this.admin.setCreature(this.data.metaId, png)), 'No se pudo guardar el recorte');
  }

  protected async removeCut(): Promise<void> {
    await this.change(() => firstValueFrom(this.admin.removeCreature(this.data.metaId)), 'No se pudo quitar el recorte');
  }

  private async change(task: () => Promise<CardMeta>, fallback: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.ref.close(await task());
    } catch (e) {
      this.error.set(apiErrorMessage(e, fallback));
    } finally {
      this.busy.set(false);
    }
  }

  /** The creature's PNG: the illustration with the mask (faded at the picture's edge), cropped round it. */
  private async cutout(): Promise<Blob | null> {
    if (!this.mask || !this.art) return null;
    const { width: w, height: h } = this.mask;
    const alpha = fadedAtEdges(this.mask);
    const box = shownBox(alpha, w, h);
    if (!box) {
      this.error.set('El recorte está vacío: agrega la criatura primero');
      return null;
    }
    this.error.set(null);
    const rgba = new ImageData(w, h);
    rgba.data.set(this.art.data);
    for (let i = 0; i < alpha.length; i++) rgba.data[i * 4 + 3] = alpha[i];
    const full = new OffscreenCanvas(w, h);
    full.getContext('2d')!.putImageData(rgba, 0, 0);
    const out = new OffscreenCanvas(box.w, box.h);
    out.getContext('2d')!.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    // It keeps where it was cropped from, so it can be edited again from where it was left
    const png = new Uint8Array(await (await out.convertToBlob({ type: 'image/png' })).arrayBuffer());
    return new Blob([withPlace(png, { x: box.x, y: box.y, width: w, height: h })], { type: 'image/png' });
  }

  private remember(): void {
    if (!this.mask) return;
    this.history.push(this.mask.data.slice());
    if (this.history.length > UNDO_STEPS) this.history.shift();
    this.undoable.set(true);
  }

  /** Where the pointer is, in pixels of the illustration. */
  private pointAt(event: PointerEvent): { x: number; y: number } {
    const canvas = this.canvas().nativeElement;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * canvas.width,
      y: ((event.clientY - box.top) / box.height) * canvas.height,
    };
  }

  private scheduleDraw(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  /** The illustration with what is left out of the creature tinted magenta. */
  private draw(): void {
    if (!this.art || !this.mask) return;
    const shown = new ImageData(this.art.width, this.art.height);
    const src = this.art.data;
    const dst = shown.data;
    const m = this.mask.data;
    for (let i = 0; i < m.length; i++) {
      const k = (255 - m[i]) / 255;
      const o = i * 4;
      dst[o] = src[o] + (200 - src[o]) * k * 0.6;
      dst[o + 1] = src[o + 1] * (1 - k * 0.6);
      dst[o + 2] = src[o + 2] + (200 - src[o + 2]) * k * 0.6;
      dst[o + 3] = 255;
    }
    this.canvas().nativeElement.getContext('2d')!.putImageData(shown, 0, 0);
  }
}
