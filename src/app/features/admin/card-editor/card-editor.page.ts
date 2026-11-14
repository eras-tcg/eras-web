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
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { CARD_COLORS, COLOR_LABELS } from '@data/cards/card.model';
import { CardHotspotsComponent } from './card-hotspots.component';
import { EffectEditorComponent } from './effect-editor.component';
import { Line, effectsToLines, linesToEffects, pieceCatalog } from './effect-text';
import { Zone, cardZones } from './render/card-zones';
import { feedbackState } from '../admin-feedback';
import {
  CARD_KINDS,
  CardKind,
  applyCardKind,
  cardKindOf,
  draftFromForm,
  exportName,
} from './card-editor-rules';
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
    StackComponent,
    SectionHeaderComponent,
    FormFieldComponent,
    AlertComponent,
    ButtonComponent,
    ChipComponent,
    CardHotspotsComponent,
    EffectEditorComponent,
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

      <div class="layout">
        <div class="card-pane">
          <div class="card-wrap" [class.framing]="framing()">
            @if (framing() && ghost(); as g) {
              <img
                class="ghost"
                alt=""
                [src]="g.src"
                [style.left.%]="g.left"
                [style.top.%]="g.top"
                [style.width.%]="g.width"
                [style.height.%]="g.height"
              />
            }
            <div
              #preview
              class="preview"
              [class.dragging]="dragging()"
              (pointerdown)="dragStart($event)"
              (pointermove)="dragMove($event)"
              (pointerup)="dragEnd()"
              (pointercancel)="dragEnd()"
              (wheel)="wheelZoom($event)"
            ></div>
            @if (!framing()) {
              <eras-card-hotspots
                [zones]="zones()"
                [(form)]="form"
                [classes]="classes()"
                (effectZone)="editEffects($event)"
              />
            }
            @if (effectZone(); as z) {
              @if (catalog(); as cat) {
                <eras-effect-editor
                  [zone]="z"
                  [lines]="effectLines()"
                  [catalog]="cat"
                  [pieces]="pieces()!"
                  (changed)="applyEffects($event)"
                  (closed)="closeEffects($event)"
                />
              }
            }
          </div>
          @if (sizes().length) {
            <span class="note">Texto de efecto: {{ sizes() }}</span>
          }
        </div>

        <eras-stack [gap]="3" class="panel">
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
          <eras-stack direction="row" [gap]="2" wrap>
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

          <eras-section-header title="Estructura" />
          <eras-form-field label="Tipo de carta">
            <select (change)="setKind($any($event.target).value)">
              @for (k of kinds; track k) {
                <option [value]="k" [selected]="k === kind()">{{ kindLabels[k] }}</option>
              }
            </select>
          </eras-form-field>
          @if (form().enlace) {
            <eras-stack direction="row" [gap]="1" wrap>
              @for (a of arrowOptions; track a.key) {
                <button
                  erasChip
                  [selected]="form().arrows.includes(a.key)"
                  (click)="toggleArrow(a.key)"
                >
                  {{ a.label }}
                </button>
              }
            </eras-stack>
          }
          <span class="label">Colores</span>
          <eras-stack direction="row" [gap]="1" wrap>
            @for (c of colors; track c) {
              <button erasChip [selected]="form().colors.includes(c)" (click)="toggleColor(c)">
                {{ colorLabels[c] }}
              </button>
            }
            @if (form().colors.length === 2) {
              <button erasChip (click)="swapColors()">Invertir colores</button>
            }
            <button erasChip [selected]="form().starter" (click)="toggleStarter()">
              Iniciador
            </button>
          </eras-stack>
          <span class="label">Marco</span>
          <eras-stack direction="row" [gap]="1" wrap>
            @for (s of styles; track s) {
              <button erasChip [selected]="style() === s" (click)="style.set(s)">
                {{ styleLabels[s] }}
              </button>
            }
          </eras-stack>

          <eras-section-header title="Arte" />
          <input type="file" accept="image/*" aria-label="Imagen" (change)="pickArt($event)" />
          @if (art(); as a) {
            <button erasChip [selected]="framing()" (click)="toggleFraming()">
              Encuadrar arte
            </button>
            <eras-form-field label="Zoom">
              <input
                type="range"
                [min]="minZoom"
                [max]="maxZoom"
                step="0.01"
                [value]="a.scale"
                (input)="zoom($any($event.target).valueAsNumber)"
              />
            </eras-form-field>
            <eras-stack direction="row" [gap]="2">
              <button erasButton variant="ghost" size="sm" type="button" (click)="centerArt()">
                Centrar
              </button>
              <button erasButton variant="ghost" size="sm" type="button" (click)="removeArt()">
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
    </eras-page>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 22rem;
      gap: var(--space-5);
      align-items: start;
    }
    @media (max-width: 56rem) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .card-pane {
      display: grid;
      justify-items: center;
      gap: var(--space-2);
    }
    .card-pane {
      overflow: hidden;
      padding: var(--space-6);
    }
    .card-wrap {
      position: relative;
      inline-size: min(100%, 34rem);
    }
    .panel {
      position: sticky;
      top: var(--space-4);
    }
    .label {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }
    .ghost {
      position: absolute;
      max-inline-size: none;
      opacity: 0.4;
      pointer-events: none;
      user-select: none;
    }
    .card-wrap.framing .preview {
      position: relative;
      outline: 2px solid var(--color-primary);
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
  /** Inherit (HER) frame chosen before the card has inherit effects. */
  private readonly her = signal(false);
  protected readonly zones = signal<Zone[]>([]);
  protected readonly effectZone = signal<Zone | null>(null);
  protected readonly kinds = Object.keys(CARD_KINDS) as CardKind[];
  protected readonly kindLabels = CARD_KINDS;
  protected readonly kind = computed(() =>
    cardKindOf(this.form(), this.her() || this.form().inheritEffects.length > 0),
  );
  protected readonly colors = CARD_COLORS;
  protected readonly colorLabels = COLOR_LABELS;
  protected readonly arrowOptions = [
    { key: 'left', label: 'Flecha izquierda' },
    { key: 'right', label: 'Flecha derecha' },
  ];
  protected readonly classes = computed(() => [...(this.store.ref()?.classes ?? [])].sort());

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
    const draft = {
      ...draftFromForm(this.form(), this.her()),
      frameStyle: this.style(),
      art: this.art(),
    };
    const built = buildCard(draft, templates, this.measure);
    this.zones.set(cardZones(built, this.measure));
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
    this.effectZone.set(null);
    this.form.set(metaFormFor(hit.card));
    this.her.set(false);
    this.metaId.set(hit.card.meta?.id ?? null);
    this.errors.set([]);
    this.fb.clear();
  }

  protected setKind(kind: CardKind): void {
    const next = applyCardKind(this.form(), kind);
    this.form.set(next.form);
    this.her.set(next.her);
  }

  protected toggleColor(c: string): void {
    this.form.update((f) => {
      const colors = f.colors.includes(c) ? f.colors.filter((x) => x !== c) : [...f.colors, c];
      // The code's color letters follow the card's colors.
      return { ...f, colors, colorIdentity: colors.join('') || f.colorIdentity };
    });
  }

  protected swapColors(): void {
    this.form.update((f) => {
      const colors = [...f.colors].reverse();
      return { ...f, colors, colorIdentity: colors.join('') || f.colorIdentity };
    });
  }

  protected toggleStarter(): void {
    this.form.update((f) => ({ ...f, starter: !f.starter }));
  }

  protected toggleArrow(a: string): void {
    this.form.update((f) => ({
      ...f,
      arrows: f.arrows.includes(a) ? f.arrows.filter((x) => x !== a) : [...f.arrows, a],
    }));
  }

  /** Labels the effect editor turns into pieces. */
  protected readonly catalog = computed(() => {
    const pieces = this.pieces();
    return pieces
      ? pieceCatalog(pieces, Object.keys(this.store.ref()?.keywordEffects ?? {}))
      : null;
  });
  /** The effect lists each effect box edits. */
  private readonly effectLists = {
    effects: ['effects', 'keywordEffects'],
    inheritEffects: ['inheritEffects', 'inheritKeywordEffects'],
    formationEffects: ['formationEffects', 'formationKeywordEffects'],
  } as const;
  /** Lines of the box being edited, taken once when it opens. */
  protected readonly effectLines = signal<Line[]>([]);

  /** An effect box was clicked: its in-card editor opens over it. */
  protected editEffects(zone: Zone): void {
    const cat = this.catalog();
    if (!cat) return;
    const [e, k] = this.effectLists[zone.key as keyof typeof this.effectLists];
    const f = this.form();
    this.effectLines.set(effectsToLines(f[e], f[k], cat));
    this.effectZone.set(zone);
  }

  protected applyEffects(lines: Line[]): void {
    const zone = this.effectZone();
    if (!zone) return;
    const [e, k] = this.effectLists[zone.key as keyof typeof this.effectLists];
    const { effects, keywords } = linesToEffects(lines);
    this.form.update((f) => ({ ...f, [e]: effects, [k]: keywords }));
  }

  protected closeEffects(lines: Line[]): void {
    this.applyEffects(lines);
    this.effectZone.set(null);
  }

  protected newCard(): void {
    this.effectZone.set(null);
    this.her.set(false);
    this.form.set(blankMeta(this.form().edition));
    this.metaId.set(null);
    this.query.set('');
    this.removeArt();
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
        this.artScreen.set(String(reader.result));
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

  /** Zoom range: below 1 the art can fit the standard frame's window, smaller than the card. */
  protected readonly minZoom = 0.2;
  protected readonly maxZoom = 4;
  /** Framing the art: the hotspots step aside, the whole image shows faded around the card, drag and wheel move it. */
  protected readonly framing = signal(false);
  /** The uploaded image as it came (screen colors), for the faded view around the card. */
  private readonly artScreen = signal<string | null>(null);
  protected readonly ghost = computed(() => {
    const a = this.art();
    const src = this.artScreen();
    if (!a || !src) return null;
    const cover = Math.max(744 / a.width, 1039 / a.height) * a.scale;
    const w = a.width * cover;
    const h = a.height * cover;
    return {
      src,
      left: (((744 - w) / 2 + a.x) / 744) * 100,
      top: (((1039 - h) / 2 + a.y) / 1039) * 100,
      width: (w / 744) * 100,
      height: (h / 1039) * 100,
    };
  });

  protected removeArt(): void {
    this.art.set(null);
    this.artScreen.set(null);
    this.framing.set(false);
  }

  protected toggleFraming(): void {
    this.effectZone.set(null);
    this.framing.update((v) => !v);
  }

  protected zoom(scale: number): void {
    const s = Math.min(this.maxZoom, Math.max(this.minZoom, scale));
    this.art.update((a) => (a ? { ...a, scale: s } : a));
  }

  protected wheelZoom(e: WheelEvent): void {
    const a = this.art();
    if (!this.framing() || !a) return;
    e.preventDefault();
    this.zoom(a.scale * Math.exp(-e.deltaY * 0.0015));
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
