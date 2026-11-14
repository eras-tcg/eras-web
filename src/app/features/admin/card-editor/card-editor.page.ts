import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { CardsStore } from '@data/cards/cards.store';
import {
  MetaForm,
  blankMeta,
  metaFormFor,
  toMetaPayload,
  validateMeta,
} from '@data/cards/meta-rules';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { SplitComponent } from '@ui/layout/split/split.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { MetaFieldsComponent } from '../../cards/meta-form/meta-fields.component';
import { feedbackState } from '../admin-feedback';
import { draftFromForm, exportName } from './card-editor-rules';
import { FRAME_STYLE_LABELS, FrameStyle, buildCard } from './render/card-build';
import {
  FontSlot,
  canCopyInstalledFonts,
  copyInstalledFonts,
  loadCardFonts,
  saveFontFile,
} from './render/card-fonts';
import { drawEffects } from './render/effect-layout';
import {
  canvasToCmyk,
  canvasToPng,
  cmykPdf,
  cmykTiff,
  download,
  svgToCanvasFine,
} from './render/print-export';
import { ArtPlacement, CardSpec, PieceTable } from './render/spec.model';
import { SvgRenderer } from './render/svg-render';
import { ColorLut, convertCanvas } from './render/color-lut';

/** Card editor (manage_cards): the card's metadata, its art and frame, a live preview and print exports. */
@Component({
  selector: 'eras-card-editor-page',
  imports: [
    PageComponent,
    SplitComponent,
    StackComponent,
    SectionHeaderComponent,
    FormFieldComponent,
    AlertComponent,
    ButtonComponent,
    ChipComponent,
    MetaFieldsComponent,
  ],
  template: `
    <eras-page title="Editor de cartas" width="wide">
      @if (fb.feedback(); as f) {
        <eras-alert [tone]="f.tone">{{ f.text }}</eras-alert>
      }
      @if (missingFonts().length) {
        <eras-alert tone="info">
          Faltan fuentes de la carta en este equipo: {{ missingNames() }}. Elige sus archivos
          (quedan solo en este navegador).
          <eras-stack direction="row" [gap]="2" wrap>
            @if (canCopyFonts) {
              <button
                erasButton
                variant="secondary"
                size="sm"
                type="button"
                (click)="useInstalledFonts()"
              >
                Usar fuentes instaladas
              </button>
            }
            @for (slot of missingFonts(); track slot.key) {
              <label class="font-pick"
                >{{ slot.label }}
                <input type="file" accept=".ttf,.otf" (change)="pickFont(slot, $event)"
              /></label>
            }
          </eras-stack>
        </eras-alert>
      }

      <eras-split aside="26rem">
        <div split-aside class="preview-pane">
          <eras-stack [gap]="3">
            <div
              #preview
              class="preview"
              [class.dragging]="dragging()"
              (pointerdown)="dragStart($event)"
              (pointermove)="dragMove($event)"
              (pointerup)="dragEnd()"
              (pointercancel)="dragEnd()"
            ></div>
            @if (sizes().length) {
              <span class="note">Texto de efecto: {{ sizes() }}</span>
            }

            <eras-section-header title="Arte y marco" />
            <eras-stack direction="row" [gap]="1" wrap>
              @for (s of styles; track s) {
                <button erasChip [selected]="style() === s" (click)="style.set(s)">
                  {{ styleLabels[s] }}
                </button>
              }
            </eras-stack>
            <eras-form-field label="Imagen">
              <input type="file" accept="image/*" (change)="pickArt($event)" />
            </eras-form-field>
            @if (art(); as a) {
              <eras-form-field label="Zoom">
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.01"
                  [value]="a.scale"
                  (input)="zoom($any($event.target).valueAsNumber)"
                />
              </eras-form-field>
              <span class="note">Arrastra la vista previa para mover el arte.</span>
              <eras-stack direction="row" [gap]="2">
                <button erasButton variant="ghost" size="sm" type="button" (click)="centerArt()">
                  Centrar
                </button>
                <button erasButton variant="ghost" size="sm" type="button" (click)="art.set(null)">
                  Quitar arte
                </button>
              </eras-stack>
            }

            <eras-section-header title="Exportar" />
            <eras-stack direction="row" [gap]="2" wrap>
              <button
                erasButton
                variant="secondary"
                type="button"
                [disabled]="!ready() || exporting()"
                (click)="exportPng()"
              >
                PNG
              </button>
              <button
                erasButton
                variant="secondary"
                type="button"
                [disabled]="!ready() || exporting()"
                (click)="exportTiff()"
              >
                TIFF CMYK
              </button>
              <button
                erasButton
                variant="secondary"
                type="button"
                [disabled]="!ready() || exporting()"
                (click)="exportPdf()"
              >
                PDF CMYK
              </button>
            </eras-stack>
          </eras-stack>
        </div>

        <eras-stack [gap]="4">
          <eras-stack direction="row" [gap]="2" align="end" wrap>
            <eras-form-field label="Abrir carta">
              <input
                type="search"
                list="card-editor-cards"
                placeholder="Nombre…"
                [value]="query()"
                (change)="open($any($event.target).value)"
                (input)="query.set($any($event.target).value)"
              />
              <datalist id="card-editor-cards">
                @for (c of matches(); track c.key) {
                  <option [value]="c.key">{{ c.label }}</option>
                }
              </datalist>
            </eras-form-field>
            <button erasButton variant="ghost" type="button" (click)="newCard()">
              Carta nueva
            </button>
            <button
              erasButton
              type="button"
              [loading]="saving()"
              [disabled]="saving()"
              (click)="save()"
            >
              Guardar metadatos
            </button>
          </eras-stack>
          @for (e of errors(); track e) {
            <eras-alert tone="danger">{{ e }}</eras-alert>
          }
          <eras-meta-fields [(form)]="form" [refData]="store.ref()" />
        </eras-stack>
      </eras-split>
    </eras-page>
  `,
  styles: `
    .preview-pane {
      position: sticky;
      top: var(--space-4);
    }
    .preview {
      width: 100%;
      aspect-ratio: 744 / 1039;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--color-surface-muted);
      cursor: grab;
      touch-action: none;
    }
    .preview.dragging {
      cursor: grabbing;
    }
    .preview ::ng-deep svg,
    .preview ::ng-deep canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .note {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .font-pick {
      display: inline-flex;
      gap: var(--space-2);
      align-items: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardEditorPage {
  protected readonly store = inject(CardsStore);
  private readonly api = inject(CardsAdminApi);
  protected readonly fb = feedbackState();
  private readonly preview = viewChild.required<ElementRef<HTMLElement>>('preview');

  protected readonly styles: FrameStyle[] = ['standard', 'semi', 'full'];
  protected readonly styleLabels = FRAME_STYLE_LABELS;

  protected readonly form = signal<MetaForm>(blankMeta());
  private readonly metaId = signal<string | null>(null);
  protected readonly style = signal<FrameStyle>('standard');
  protected readonly art = signal<ArtPlacement | null>(null);
  protected readonly query = signal('');
  protected readonly saving = signal(false);
  protected readonly exporting = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly dragging = signal(false);
  protected readonly sizes = signal('');

  private readonly templates = signal<Record<string, CardSpec> | null>(null);
  private readonly pieces = signal<PieceTable | null>(null);
  private readonly fontCss = signal<string | null>(null);
  private readonly lut = signal<ColorLut | null>(null);
  /** Increases with every redraw, so a slow preview never replaces a newer one. */
  private generation = 0;
  protected readonly missingFonts = signal<FontSlot[]>([]);
  protected readonly missingNames = computed(() =>
    this.missingFonts()
      .map((s) => s.label)
      .join(', '),
  );
  protected readonly ready = computed(
    () => !!this.templates() && !!this.pieces() && this.fontCss() !== null,
  );

  private readonly openable = computed(() =>
    this.store
      .cards()
      .filter((c) => c.meta)
      .map((c) => ({
        key: `${c.meta!.cardName} · ${c.edition}-${c.color_identity}${String(c.number ?? '').padStart(2, '0')}`,
        label: c.meta!.cardName ?? '',
        card: c,
      })),
  );
  protected readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.openable()
      .filter((c) => !q || c.key.toLowerCase().includes(q))
      .slice(0, 40);
  });

  private readonly ctx = document.createElement('canvas').getContext('2d')!;
  private readonly measure = (text: string, font: string) => {
    this.ctx.font = font;
    return this.ctx.measureText(text).width;
  };
  private lastSvg: SVGSVGElement | null = null;
  /** Bevels of the last preview, computed after it is shown. */
  private baking: Promise<void> = Promise.resolve();
  private dragFrom: { x: number; y: number; ax: number; ay: number } | null = null;

  constructor() {
    void this.store.load();
    void this.loadAssets();
    effect(() => this.draw());
  }

  private async loadAssets(): Promise<void> {
    try {
      const [templates, pieces, lut] = await Promise.all([
        fetch('/card-maker/templates.json').then((r) => r.json()),
        fetch('/card-maker/pieces.json').then((r) => r.json()),
        fetch('/card-maker/color-lut.bin').then((r) => r.arrayBuffer()),
      ]);
      this.lut.set(new ColorLut(new Uint8Array(lut)));
      this.templates.set(templates);
      this.pieces.set(pieces);
      await this.loadFonts();
    } catch (e) {
      this.fb.fail(e, 'No se pudieron cargar las plantillas de carta');
    }
  }

  private async loadFonts(): Promise<void> {
    const fonts = await loadCardFonts();
    this.missingFonts.set(fonts.missing);
    this.fontCss.set(fonts.css);
  }

  protected readonly canCopyFonts = canCopyInstalledFonts();

  /** Takes the installed font files through the browser's font access permission. */
  protected async useInstalledFonts(): Promise<void> {
    try {
      const found = await copyInstalledFonts(this.missingFonts());
      if (!found.length) this.fb.fail(null, 'El navegador no entregó las fuentes instaladas');
      await this.loadFonts();
    } catch (e) {
      this.fb.fail(e, 'El navegador no dio acceso a las fuentes instaladas');
    }
  }

  protected async pickFont(slot: FontSlot, event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await saveFontFile(slot.key, file);
    await this.loadFonts();
  }

  /** Redraws the preview whenever the form, art, frame or assets change. */
  private draw(): void {
    const templates = this.templates();
    const pieces = this.pieces();
    const css = this.fontCss();
    const host = this.preview().nativeElement;
    const lut = this.lut();
    if (!templates || !pieces || css === null || !lut) return;
    const draft = { ...draftFromForm(this.form()), frameStyle: this.style(), art: this.art() };
    const built = buildCard(draft, templates, this.measure);
    const r = new SvgRenderer(built, css);
    r.render();
    const layouts = drawEffects(
      r,
      built,
      pieces,
      this.store.ref()?.keywordEffects ?? {},
      this.measure,
    );
    this.sizes.set(
      layouts
        .map((l) => `${String(l.pt).replace('.', ',')} pt${l.fits ? '' : ' (no cabe)'}`)
        .join(' · '),
    );
    this.lastSvg = r.svg;
    this.baking = r.bake();
    // The preview shows the screen colors (as Photoshop's Save for Web), drawn once the bevels are ready.
    const gen = ++this.generation;
    void this.baking
      .then(() => svgToCanvasFine(r.svg))
      .then((canvas) => {
        if (gen === this.generation)
          host.replaceChildren(convertCanvas(canvas, (px) => lut.forward(px)));
      })
      .catch((e) => this.fb.fail(e, 'No se pudo dibujar la carta'));
  }

  // ── Card ──────────────────────────────────────────────────────────────

  protected open(key: string): void {
    const hit = this.openable().find((m) => m.key === key);
    if (!hit) return;
    this.form.set(metaFormFor(hit.card));
    this.metaId.set(hit.card.meta?.id ?? null);
    this.errors.set([]);
    this.fb.clear();
  }

  protected newCard(): void {
    this.form.set(blankMeta(this.form().edition));
    this.metaId.set(null);
    this.query.set('');
    this.art.set(null);
  }

  protected async save(): Promise<void> {
    const errors = validateMeta(this.form());
    this.errors.set(errors);
    if (errors.length) return;
    this.saving.set(true);
    try {
      const payload = toMetaPayload(this.form());
      const id = this.metaId();
      const saved = await firstValueFrom(
        id ? this.api.updateMeta(id, payload) : this.api.createMeta(payload),
      );
      if (saved?.id) this.metaId.set(saved.id);
      this.fb.ok('Metadatos guardados');
      void this.store.load(true);
    } catch (e) {
      this.fb.fail(e, 'No se pudieron guardar los metadatos');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Art ───────────────────────────────────────────────────────────────

  protected pickArt(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // The art comes in screen sRGB: take it to the card's design space, as Photoshop does when it enters the CMYK file.
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        const lut = this.lut();
        if (lut) convertCanvas(c, (px) => lut.inverse(px));
        this.art.set({
          src: c.toDataURL('image/jpeg', 0.95),
          width: c.width,
          height: c.height,
          scale: 1,
          x: 0,
          y: 0,
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  protected zoom(scale: number): void {
    this.art.update((a) => (a ? { ...a, scale } : a));
  }

  protected centerArt(): void {
    this.art.update((a) => (a ? { ...a, x: 0, y: 0 } : a));
  }

  protected dragStart(e: PointerEvent): void {
    const a = this.art();
    if (!a) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.dragFrom = { x: e.clientX, y: e.clientY, ax: a.x, ay: a.y };
    this.dragging.set(true);
  }

  protected dragMove(e: PointerEvent): void {
    if (!this.dragFrom) return;
    // Screen pixels → card pixels.
    const k = 744 / this.preview().nativeElement.clientWidth;
    const { x, y, ax, ay } = this.dragFrom;
    this.art.update((a) =>
      a ? { ...a, x: ax + (e.clientX - x) * k, y: ay + (e.clientY - y) * k } : a,
    );
  }

  protected dragEnd(): void {
    this.dragFrom = null;
    this.dragging.set(false);
  }

  // ── Exports ───────────────────────────────────────────────────────────

  private async canvas(): Promise<HTMLCanvasElement> {
    if (!this.lastSvg) throw new Error('Sin vista previa');
    await this.baking;
    return svgToCanvasFine(this.lastSvg);
  }

  private async exporting$(run: () => Promise<void>): Promise<void> {
    this.exporting.set(true);
    try {
      await run();
    } catch (e) {
      this.fb.fail(e, 'No se pudo exportar la carta');
    } finally {
      this.exporting.set(false);
    }
  }

  protected exportPng(): Promise<void> {
    // PNG in screen colors (Save for Web); the CMYK files keep the design colors.
    const lut = this.lut();
    return this.exporting$(async () =>
      download(
        await canvasToPng(convertCanvas(await this.canvas(), (px) => lut?.forward(px))),
        `${exportName(this.form())}.png`,
      ),
    );
  }

  protected exportTiff(): Promise<void> {
    return this.exporting$(async () =>
      download(cmykTiff(canvasToCmyk(await this.canvas())), `${exportName(this.form())} CMYK.tif`),
    );
  }

  protected exportPdf(): Promise<void> {
    return this.exporting$(async () =>
      download(
        await cmykPdf([canvasToCmyk(await this.canvas())]),
        `${exportName(this.form())} CMYK.pdf`,
      ),
    );
  }
}
