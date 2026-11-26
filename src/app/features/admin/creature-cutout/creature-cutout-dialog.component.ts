import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { ApiConfig } from '@core/http/api-config';
import { CardMeta } from '@data/cards/card.model';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { CreatureSummonComponent } from '@ui/domain/creature-summon/creature-summon.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { firstValueFrom } from 'rxjs';
import { Mask, combine, dab, edgeFades, emptyMask, fadeDab, maskFromCutout, shownBox } from './cutout-mask';
import { ALL_EDGES, CutoutEdges, NO_EDGES, placeOf, withPlace } from '@ui/domain/creature-summon/cutout-place';
import { CutoutSam } from './cutout-sam';

export interface CreatureCutoutData {
  metaId: string;
  name: string;
  level: number | null;
  identity: string;
  /** Its cut-out saved now (its address), or null: the editor starts from it. */
  creature: string | null;
}

type Tool = 'add' | 'remove' | 'paint' | 'erase' | 'fade';
/** The tools that paint with the brush. */
const BRUSHES: readonly Tool[] = ['paint', 'erase', 'fade'];

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
        @if (isBrush()) {
          <label class="size">
            Tamaño: <span class="size-value">{{ brush() }} px</span>
            <input type="range" min="1" max="120" step="1" aria-label="Tamaño del pincel" [value]="brush()" (input)="brush.set(+$any($event.target).value)" />
          </label>
          @if (tool() === 'fade') {
            <label class="size">
              Intensidad: <span class="size-value">{{ fadeStrength() }} %</span>
              <input type="range" min="5" max="100" step="5" aria-label="Intensidad del desvanecido" [value]="fadeStrength()" (input)="fadeStrength.set(+$any($event.target).value)" />
            </label>
          }
        }
        <div class="group">
          <button erasButton variant="ghost" size="sm" type="button" [disabled]="zoom() === 1" (click)="fit()">Ajustar ({{ zoomText() }})</button>
          <button erasButton variant="ghost" size="sm" type="button" [disabled]="!undoable()" (click)="undo()">Deshacer</button>
          <button erasButton variant="ghost" size="sm" type="button" [disabled]="!redoable()" (click)="redo()">Rehacer</button>
          <button erasButton variant="ghost" size="sm" type="button" [disabled]="!mask" (click)="clear()">Limpiar</button>
        </div>
      </div>
      <!-- An even fade from the picture's edges chosen, as wide as asked (seen as it will be saved) -->
      <div class="tools" role="group" aria-label="Desvanecer bordes">
        <span class="edges-title">Desvanecer bordes:</span>
        <div class="group">
          @for (e of edgeButtons; track e.id) {
            <button
              erasButton
              size="sm"
              type="button"
              [variant]="fadeEdges()[e.id] ? 'primary' : 'secondary'"
              [attr.aria-pressed]="fadeEdges()[e.id]"
              (click)="toggleEdge(e.id)"
            >
              {{ e.label }}
            </button>
          }
        </div>
        <label class="size">
          Ancho: <span class="size-value">{{ fadeWidth() }} %</span>
          <input type="range" min="2" max="40" step="1" aria-label="Ancho del desvanecido de bordes" [value]="fadeWidth()" (input)="setFadeWidth(+$any($event.target).value)" />
        </label>
      </div>
      @if (status(); as s) {
        <p class="status" aria-live="polite">{{ s }}</p>
      }
      @if (error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      <div class="canvas-box" #box [class.panning]="panning()" (wheel)="wheel($event)" (pointerdown)="panStart($event)">
        <canvas
          #canvas
          [class.brush]="isBrush()"
          [style.left.px]="view().x"
          [style.top.px]="view().y"
          [style.width.px]="view().w"
          [style.height.px]="view().h"
          (pointerdown)="down($event)"
          (pointermove)="move($event)"
          (pointerleave)="hover.set(null)"
          (pointerup)="up()"
          (pointercancel)="up()"
          (contextmenu)="$event.preventDefault()"
        ></canvas>
        @if (reach(); as r) {
          <span class="reach" aria-hidden="true" [style.left.px]="r.x" [style.top.px]="r.y" [style.width.px]="r.d" [style.height.px]="r.d"></span>
        }
      </div>
      <p class="hint">
        Agregar o Quitar parte: un clic sobre ella. Pincel, Borrador y Desvanecer (transparenta de a poco, suave en el borde): arrastrar. Lo que queda fuera se ve en magenta.
        Ctrl + rueda: acercar o alejar. Rueda, botón central o espacio + arrastrar: mover la vista. Ctrl + Z: deshacer. Ctrl + Y: rehacer. Alt: ver la ilustración sin la máscara.
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
      <eras-creature-summon [creature]="url" [name]="data.name" [level]="data.level" [identity]="data.identity" (done)="endPreview()" />
    }
  `,
  styles: `
    /* The whole screen: the illustration as big as it fits, and zoomed in from there */
    .editor {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      box-sizing: border-box;
      inline-size: 100vw;
      block-size: 100dvh;
      background: var(--color-surface);
      color: var(--color-text);
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
    /* Room for "120 px" always, so the slider never moves */
    .edges-title {
      font-size: var(--font-size-sm, 0.875rem);
      color: var(--color-text-muted);
    }
    .size-value {
      display: inline-block;
      min-inline-size: 6ch;
      font-variant-numeric: tabular-nums;
    }
    .size input {
      inline-size: 160px;
    }
    /* Where the brush or the eraser reaches, round the pointer */
    .reach {
      position: absolute;
      border-radius: 50%;
      border: 1px solid #fff;
      box-shadow: 0 0 0 1px rgb(0 0 0 / 80%);
      pointer-events: none;
      transform: translate(-50%, -50%);
    }
    .status,
    .hint {
      margin: 0;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm, 0.875rem);
    }
    .canvas-box {
      position: relative;
      flex: 1 1 0;
      min-block-size: 0;
      overflow: hidden;
      background: #111;
      border-radius: var(--radius-md, 8px);
    }
    canvas {
      position: absolute;
      cursor: crosshair;
      touch-action: none;
      image-rendering: pixelated;
    }
    .panning,
    .panning canvas {
      cursor: grabbing;
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
    { id: 'fade', label: 'Desvanecer', brush: true },
  ];
  protected readonly tool = signal<Tool>('add');
  protected readonly isBrush = computed(() => BRUSHES.includes(this.tool()));
  /** How many pixels of the illustration the brush covers across (1: a single pixel). */
  protected readonly brush = signal(6);
  /** How much one stroke of the Desvanecer brush takes away at its middle (%): a stroke again fades further. */
  protected readonly fadeStrength = signal(25);
  /** "Desvanecer bordes": which edges of the picture the figure fades out from, and how far in (% of its shorter side). */
  protected readonly fadeEdges = signal<CutoutEdges>(NO_EDGES);
  protected readonly fadeWidth = signal(16);
  protected readonly edgeButtons: { id: keyof CutoutEdges; label: string }[] = [
    { id: 'top', label: 'Arriba' },
    { id: 'bottom', label: 'Abajo' },
    { id: 'left', label: 'Izquierda' },
    { id: 'right', label: 'Derecha' },
  ];
  /** How much of each pixel shows with that fade (all 1 without one), kept for drawing and saving. */
  private fades: Float32Array | null = null;
  protected readonly samReady = signal(false);
  protected readonly status = signal<string | null>('Cargando la ilustración…');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly undoable = signal(false);
  protected readonly redoable = signal(false);
  /** Where the pointer is over the illustration (in its box), for the brush's reach. */
  protected readonly hover = signal<{ x: number; y: number } | null>(null);
  /** The circle the brush or the eraser reaches, as big as it is on screen. */
  protected readonly reach = computed(() => {
    const at = this.hover();
    if (!at || !this.isBrush() || this.panning()) return null;
    const scale = this.view().w / (this.artSize().w || 1);
    return { x: at.x, y: at.y, d: Math.max(2, this.brush() * scale) };
  });
  protected readonly previewUrl = signal<string | null>(null);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');

  /** How much closer than fitting the illustration is seen (1: all of it in view), and where the view is moved to. */
  protected readonly zoom = signal(1);
  private readonly pan = signal({ x: 0, y: 0 });
  /** The box's size and the illustration's (its pixels). */
  private readonly boxSize = signal({ w: 0, h: 0 });
  private readonly artSize = signal({ w: 0, h: 0 });
  protected readonly panning = signal(false);
  private space = false;
  private drag: { x: number; y: number } | null = null;
  protected readonly zoomText = computed(() => `${Math.round(this.zoom() * 100)} %`);
  /** Where the illustration is drawn in its box and how big: fitted, zoomed, moved. */
  protected readonly view = computed(() => {
    const { w: bw, h: bh } = this.boxSize();
    const { w: aw, h: ah } = this.artSize();
    if (!aw || !bw) return { x: 0, y: 0, w: 0, h: 0 };
    const k = Math.min(bw / aw, bh / ah) * this.zoom();
    const w = aw * k;
    const h = ah * k;
    return { x: (bw - w) / 2 + this.pan().x, y: (bh - h) / 2 + this.pan().y, w, h };
  });
  protected mask: Mask | null = null;
  private art: ImageData | null = null;
  private artUrl: string | null = null;
  private sam: CutoutSam | null = null;
  private history: Uint8ClampedArray[] = [];
  private future: Uint8ClampedArray[] = [];
  /** The Desvanecer stroke under way: the mask when it began and how far it reached each pixel. */
  private fadeBase: Uint8ClampedArray | null = null;
  private fadeReach: Float32Array | null = null;
  /** Alt held: the illustration without the mask. */
  private plain = false;
  private stroke: { x: number; y: number } | null = null;
  private frame = 0;

  constructor() {
    afterNextRender(() => {
      const box = this.box().nativeElement;
      const resize = new ResizeObserver(() => this.boxSize.set({ w: box.clientWidth, h: box.clientHeight }));
      resize.observe(box);
      destroy.onDestroy(() => resize.disconnect());
      void this.start();
    });
    // Ctrl + Z undoes and Ctrl + Y (or Ctrl + Shift + Z) redoes, a step per press (a key held does not repeat it); the
    // space bar held moves the view while dragging
    const keys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
        event.preventDefault();
        if (event.type !== 'keydown' || event.repeat) return;
        if (key === 'y' || event.shiftKey) this.redo();
        else this.undo();
      }
      // Alt held: the illustration as it is, without the magenta over what is left out
      if (event.key === 'Alt') {
        event.preventDefault();
        this.showPlain(event.type === 'keydown');
      }
      if (event.key === ' ') {
        this.space = event.type === 'keydown';
        if ((event.target as HTMLElement).tagName !== 'INPUT') event.preventDefault();
      }
    };
    document.addEventListener('keydown', keys);
    document.addEventListener('keyup', keys);
    // Alt let go while the window was elsewhere: back to the mask
    const blur = () => this.showPlain(false);
    window.addEventListener('blur', blur);
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('keyup', keys);
      window.removeEventListener('blur', blur);
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
      this.artSize.set({ w, h });
      this.mask = emptyMask(w, h);
      // SAM reads the illustration as it is shown (its size, so its parts match the mask)
      const scaled = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
      this.artUrl = scaled ? URL.createObjectURL(scaled) : null;
      if (this.data.creature) note = await this.resume(this.data.creature, w, h);
      if (!this.fades) this.refade();
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

  protected toggleEdge(edge: keyof CutoutEdges): void {
    this.fadeEdges.update((e) => ({ ...e, [edge]: !e[edge] }));
    this.refade();
  }

  protected setFadeWidth(width: number): void {
    this.fadeWidth.set(width);
    this.refade();
  }

  /** The edge fade worked out again (its edges or its width changed) and shown. */
  private refade(): void {
    if (!this.mask) return;
    this.fades = edgeFades(this.mask.width, this.mask.height, this.fadeWidth() / 100, this.fadeEdges());
    this.scheduleDraw();
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
      // Its edge fade comes back as it was chosen (the old saves faded all four edges by 16 %)
      const old = place.fade === undefined;
      this.fadeEdges.set(old ? ALL_EDGES : (place.edges ?? NO_EDGES));
      if (old || (place.fade ?? 0) > 0) this.fadeWidth.set(Math.round((place.fade ?? 0.16) * 100));
      this.refade();
      return null;
    } catch {
      return 'No se pudo abrir el recorte guardado: este empieza desde cero.';
    }
  }

  /** Ctrl + wheel zooms in or out on the pointer; the wheel alone moves the view. */
  protected wheel(event: WheelEvent): void {
    event.preventDefault();
    if (!(event.ctrlKey || event.metaKey)) {
      this.pan.update((p) => ({ x: p.x - event.deltaX, y: p.y - event.deltaY }));
      return;
    }
    const box = this.box().nativeElement.getBoundingClientRect();
    const before = this.view();
    const zoom = Math.min(16, Math.max(1, this.zoom() * Math.exp(-event.deltaY * 0.0015)));
    if (zoom === this.zoom()) return;
    // The point under the pointer stays under it
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    const k = zoom / this.zoom();
    this.zoom.set(zoom);
    const after = this.view();
    const x = px - (px - before.x) * k;
    const y = py - (py - before.y) * k;
    this.pan.update((p) => (zoom === 1 ? { x: 0, y: 0 } : { x: p.x + x - after.x, y: p.y + y - after.y }));
  }

  /** The whole illustration in view again. */
  protected fit(): void {
    this.zoom.set(1);
    this.pan.set({ x: 0, y: 0 });
  }

  /** The middle button, or the space bar held, drags the view. */
  protected panStart(event: PointerEvent): void {
    if (event.button !== 1 && !this.space) return;
    event.preventDefault();
    event.stopPropagation();
    const el = this.box().nativeElement;
    el.setPointerCapture(event.pointerId);
    this.drag = { x: event.clientX, y: event.clientY };
    this.panning.set(true);
    const move = (e: PointerEvent) => {
      if (!this.drag) return;
      this.pan.update((p) => ({ x: p.x + e.clientX - this.drag!.x, y: p.y + e.clientY - this.drag!.y }));
      this.drag = { x: e.clientX, y: e.clientY };
    };
    const end = () => {
      this.drag = null;
      this.panning.set(false);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  protected async down(event: PointerEvent): Promise<void> {
    // Moving the view, not editing
    if (event.button === 1 || this.space) return;
    if (!this.mask || this.busy()) return;
    const at = this.pointAt(event);
    const tool = this.tool();
    if (BRUSHES.includes(tool)) {
      this.remember();
      this.stroke = at;
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      if (tool === 'fade') {
        this.fadeBase = this.mask.data.slice();
        this.fadeReach = new Float32Array(this.mask.data.length);
      }
      this.brushAt(at.x, at.y);
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
    const box = this.box().nativeElement.getBoundingClientRect();
    this.hover.set({ x: event.clientX - box.left, y: event.clientY - box.top });
    if (!this.stroke || !this.mask) return;
    const at = this.pointAt(event);
    const size = this.brush();
    // Dabs along the way, close enough to make a line (every half pixel at least, for a thin brush)
    const steps = Math.max(1, Math.ceil(Math.hypot(at.x - this.stroke.x, at.y - this.stroke.y) / Math.max(0.5, size / 4)));
    for (let i = 1; i <= steps; i++) {
      this.brushAt(this.stroke.x + ((at.x - this.stroke.x) * i) / steps, this.stroke.y + ((at.y - this.stroke.y) * i) / steps);
    }
    this.stroke = at;
    this.scheduleDraw();
  }

  /** One dab of the brush in use: painting the creature in, erasing it, or fading it out softly. */
  private brushAt(x: number, y: number): void {
    if (!this.mask) return;
    const tool = this.tool();
    if (tool === 'fade') {
      if (this.fadeBase && this.fadeReach) fadeDab(this.mask, this.fadeBase, this.fadeReach, x, y, this.brush(), this.fadeStrength() / 100);
    } else dab(this.mask, x, y, this.brush(), tool === 'paint');
  }

  protected up(): void {
    this.stroke = null;
    this.fadeBase = null;
    this.fadeReach = null;
  }

  protected undo(): void {
    const last = this.history.pop();
    if (!last || !this.mask) return;
    this.future.push(this.mask.data);
    this.mask = { ...this.mask, data: last };
    this.steps();
    this.draw();
  }

  protected redo(): void {
    const next = this.future.pop();
    if (!next || !this.mask) return;
    this.history.push(this.mask.data);
    this.mask = { ...this.mask, data: next };
    this.steps();
    this.draw();
  }

  private steps(): void {
    this.undoable.set(this.history.length > 0);
    this.redoable.set(this.future.length > 0);
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

  /** The creature's PNG: the illustration with the mask (faded from the edges chosen), cropped round it. */
  private async cutout(): Promise<Blob | null> {
    if (!this.mask || !this.art) return null;
    const { width: w, height: h } = this.mask;
    const fades = this.fades;
    const alpha = fades ? this.mask.data.map((v, i) => v * fades[i]) : this.mask.data;
    // Cropped round the figure before its fade, so the faded rim is kept and it reopens whole
    const box = shownBox(this.mask.data, w, h);
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
    return new Blob([withPlace(png, { x: box.x, y: box.y, width: w, height: h, fade: this.fadeWidth() / 100, edges: this.fadeEdges() })], { type: 'image/png' });
  }

  private remember(): void {
    if (!this.mask) return;
    this.history.push(this.mask.data.slice());
    if (this.history.length > UNDO_STEPS) this.history.shift();
    // A new change: what was undone cannot be redone any more
    this.future = [];
    this.steps();
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
  /** Shows the illustration alone (Alt held) or with the mask over it again. */
  private showPlain(plain: boolean): void {
    if (plain === this.plain) return;
    this.plain = plain;
    this.draw();
  }

  private draw(): void {
    if (!this.art || !this.mask) return;
    if (this.plain) {
      this.canvas().nativeElement.getContext('2d')!.putImageData(this.art, 0, 0);
      return;
    }
    const shown = new ImageData(this.art.width, this.art.height);
    const src = this.art.data;
    const dst = shown.data;
    const m = this.mask.data;
    // As it will be saved: the edge fade over the mask
    const f = this.fades;
    for (let i = 0; i < m.length; i++) {
      const k = (255 - m[i] * (f ? f[i] : 1)) / 255;
      const o = i * 4;
      dst[o] = src[o] + (200 - src[o]) * k * 0.6;
      dst[o + 1] = src[o + 1] * (1 - k * 0.6);
      dst[o + 2] = src[o + 2] + (200 - src[o + 2]) * k * 0.6;
      dst[o + 3] = 255;
    }
    this.canvas().nativeElement.getContext('2d')!.putImageData(shown, 0, 0);
  }
}
