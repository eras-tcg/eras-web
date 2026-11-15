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
import { CardsStore } from '@data/cards/cards.store';
import { firstValueFrom } from 'rxjs';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { CardMeta } from '@data/cards/card.model';
import {
  MetaForm,
  blankMeta,
  formFromMeta,
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
  CARD_TYPES,
  CardType,
  DraftDesign,
  cardColorsOf,
  draftFromForm,
  readDesign,
  swapCardColors,
  toggleCardColor,
  withCardType,
  withLink,
  withoutInherit,
} from './card-editor-rules';
import { FRAME_STYLE_LABELS, FrameStyle, buildCard, cardCode } from './render/card-build';
import {
  FontSlot,
  canCopyInstalledFonts,
  copyInstalledFonts,
  loadCardFonts,
  saveFontFile,
} from './render/card-fonts';
import { drawEffects } from './render/effect-layout';
import { svgToCanvasFine } from './render/print-export';
import { ArtPlacement, CardSpec, PieceTable } from './render/spec.model';
import { SvgRenderer } from './render/svg-render';
import { ColorLut, convertCanvas } from './render/color-lut';

/** Card editor (manage_cards): the card's document (metadata, design, art) and a live preview. */
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
            @if ((framing() || pendingArt()) && ghost(); as g) {
              <img
                class="ghost"
                [class.live]="!!pendingArt()"
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
                [noCost]="noCost()"
                [noStrength]="noStrength()"
                (toggled)="toggleValue($event)"
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
              Guardar
            </button>
          </eras-stack>

          <eras-section-header title="Estructura" />
          <eras-form-field label="Tipo de carta">
            <select (change)="setType($any($event.target).value)">
              @for (t of types; track t) {
                <option [value]="t" [selected]="t === form().cardType">{{ typeLabels[t] }}</option>
              }
            </select>
          </eras-form-field>
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
          </eras-stack>
          <span class="label">Marco</span>
          <eras-stack direction="row" [gap]="1" wrap>
            @for (s of styles; track s) {
              <button erasChip [selected]="style() === s" (click)="style.set(s)">
                {{ styleLabels[s] }}
              </button>
            }
          </eras-stack>

          <eras-section-header title="Extras" />
          <eras-stack direction="row" [gap]="1" wrap>
            <button erasChip [selected]="goldBorder()" (click)="goldBorder.set(!goldBorder())">
              Borde dorado
            </button>
            @if (!form().enlace) {
              <button erasChip [selected]="inherit()" (click)="toggleInherit()">Heredable</button>
            }
            @if (form().cardType === 'creature') {
              <button erasChip [selected]="form().enlace" (click)="toggleLink()">Enlace</button>
            }
          </eras-stack>
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
                (input)="previewZoom($any($event.target).valueAsNumber)"
                (change)="commitArt()"
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
    .ghost.live {
      z-index: 2;
      opacity: 0.6;
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

  protected readonly form = signal<MetaForm>({ ...blankMeta(), colors: ['W'] });
  protected readonly style = signal<FrameStyle>('standard');
  protected readonly art = signal<ArtPlacement | null>(null);
  protected readonly query = signal('');
  protected readonly dragging = signal(false);
  protected readonly saving = signal(false);
  /** The card being edited (null: not saved yet). */
  private readonly metaId = signal<string | null>(null);
  /** The art changed since the last save: a new file to upload, or removed. */
  private artFile: Blob | null = null;
  private artChanged = false;
  protected readonly sizes = signal('');
  /** Inherit (HER) frame chosen before the card has inherit effects. */
  private readonly her = signal(false);
  /** Cost / strength left out of the card (saved as empty values). */
  protected readonly noCost = signal(false);
  protected readonly noStrength = signal(false);
  protected readonly goldBorder = signal(false);
  protected readonly zones = signal<Zone[]>([]);
  protected readonly effectZone = signal<Zone | null>(null);
  protected readonly types = Object.keys(CARD_TYPES) as CardType[];
  protected readonly typeLabels = CARD_TYPES;
  /** Inherit frame: chosen, or the card already has inherit effects. */
  protected readonly inherit = computed(
    () =>
      this.her() ||
      this.form().inheritEffects.length > 0 ||
      this.form().inheritKeywordEffects.length > 0,
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

  /** Every card in the system, by name and code. */
  private readonly openable = computed(() =>
    this.store.metaList().map((m) => {
      const form = formFromMeta(m);
      return {
        key: `${form.cardName || 'Sin nombre'} · ${cardCode(draftFromForm(form))}`,
        label: form.cardName,
        meta: m,
      };
    }),
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
      noCost: this.noCost(),
      noStrength: this.noStrength(),
      goldBorder: this.goldBorder(),
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
    const baking = r.bake();
    // The preview shows the screen colors (as Photoshop's Save for Web), drawn once the bevels are ready.
    const gen = ++this.generation;
    void baking
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
    if (hit) void this.openCard(hit.meta);
  }

  /** Clears the editor for another card. */
  private reset(form: MetaForm): void {
    this.effectZone.set(null);
    this.form.set(form);
    this.metaId.set(null);
    this.her.set(false);
    this.noCost.set(false);
    this.noStrength.set(false);
    this.goldBorder.set(false);
    this.style.set('standard');
    this.removeArt();
    this.artChanged = false;
    this.fb.clear();
  }

  private async openCard(m: CardMeta): Promise<void> {
    const form = formFromMeta(m);
    this.reset({ ...form, colors: cardColorsOf(form) });
    this.metaId.set(m.id);
    const design = readDesign(m.design);
    this.style.set(design.frameStyle);
    this.goldBorder.set(design.goldBorder);
    this.her.set(design.her);
    // Cards made before the editor: cost and strength left out are the empty ones.
    this.noCost.set(m.design ? design.noCost : form.cost === null);
    this.noStrength.set(
      m.design ? design.noStrength : form.cardType === 'creature' && form.strength === null,
    );
    if (!m.artKey) return;
    try {
      const blob = await firstValueFrom(this.api.art(m.id));
      if (this.metaId() !== m.id) return;
      this.loadArt(await dataUrl(blob), design.art ?? { scale: 1, x: 0, y: 0 });
    } catch (e) {
      this.fb.fail(e, 'No se pudo cargar el arte de la carta');
    }
  }

  protected toggleValue(which: 'cost' | 'strength'): void {
    const flag = which === 'cost' ? this.noCost : this.noStrength;
    flag.set(!flag());
    // A value left out is saved empty.
    if (flag()) this.form.update((f) => ({ ...f, [which]: null }));
  }

  protected setType(t: CardType): void {
    this.form.update((f) => withCardType(f, t));
  }

  protected toggleInherit(): void {
    if (this.inherit()) {
      this.her.set(false);
      this.form.update(withoutInherit);
    } else this.her.set(true);
  }

  protected toggleLink(): void {
    const on = !this.form().enlace;
    if (on) this.her.set(false);
    this.form.update((f) => withLink(f, on));
  }

  protected toggleColor(c: string): void {
    this.form.update((f) => toggleCardColor(f, c));
  }

  protected swapColors(): void {
    this.form.update(swapCardColors);
  }

  // ── Saving ────────────────────────────────────────────────────────────

  /** A new card: a blank canvas (white creature); its code and name are written on the card. */
  protected newCard(): void {
    this.reset({ ...blankMeta(), colors: ['W'] });
  }

  private design(): DraftDesign {
    const a = this.art();
    return {
      frameStyle: this.style(),
      goldBorder: this.goldBorder(),
      her: this.her(),
      noCost: this.noCost(),
      noStrength: this.noStrength(),
      art: a ? { scale: a.scale, x: a.x, y: a.y } : null,
    };
  }

  /** Saves the card's document (a new card is created), then its art if it changed. */
  protected async save(): Promise<void> {
    if (this.saving()) return;
    const errors = validateMeta(this.form());
    if (!this.form().cardNumber) errors.push('Falta el número de la carta.');
    if (errors.length) {
      this.fb.fail(null, errors.join(' '));
      return;
    }
    this.saving.set(true);
    try {
      const body = { ...toMetaPayload(this.form()), design: { ...this.design() } };
      const id = this.metaId();
      const saved = await firstValueFrom(
        id ? this.api.updateMeta(id, body) : this.api.createMeta(body),
      );
      this.metaId.set(saved.id);
      if (this.artChanged) {
        await firstValueFrom(
          this.artFile ? this.api.setArt(saved.id, this.artFile) : this.api.removeArt(saved.id),
        );
        this.artChanged = false;
        this.artFile = null;
      }
      this.fb.ok('Carta guardada');
      void this.store.load(true);
    } catch (e) {
      this.fb.fail(e, 'No se pudo guardar la carta');
    } finally {
      this.saving.set(false);
    }
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

  // ── Art ───────────────────────────────────────────────────────────────

  protected async pickArt(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.artFile = file;
    this.artChanged = true;
    this.loadArt(await dataUrl(file), { scale: 1, x: 0, y: 0 });
  }

  /** Shows an art (as a data URL) with its framing. */
  private loadArt(src: string, place: { scale: number; x: number; y: number }): void {
    const img = new Image();
    img.onload = () => {
      // The art comes in screen sRGB: take it to the card's design space, as Photoshop does when it enters the CMYK file.
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      const lut = this.lut();
      this.artScreen.set(src);
      if (lut) convertCanvas(c, (px) => lut.inverse(px));
      this.art.set({
        src: c.toDataURL('image/jpeg', 0.95),
        width: c.width,
        height: c.height,
        ...place,
      });
    };
    img.src = src;
  }

  /** Zoom range: below 1 the art can fit the standard frame's window, smaller than the card. */
  protected readonly minZoom = 0.2;
  protected readonly maxZoom = 4;
  /** Framing the art: the hotspots step aside, the whole image shows faded around the card, drag and wheel move it. */
  protected readonly framing = signal(false);
  /** The uploaded image as it came (screen colors), for the faded view around the card. */
  private readonly artScreen = signal<string | null>(null);
  /**
   * Placement being moved (drag, wheel, zoom slider): only the faded image follows it; the card is redrawn once,
   * when the move ends.
   */
  protected readonly pendingArt = signal<ArtPlacement | null>(null);
  private wheelTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly ghost = computed(() => {
    const a = this.pendingArt() ?? this.art();
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
    if (this.art()) this.artChanged = true;
    this.artFile = null;
    this.art.set(null);
    this.artScreen.set(null);
    this.framing.set(false);
  }

  protected toggleFraming(): void {
    this.effectZone.set(null);
    this.framing.update((v) => !v);
  }

  private clampZoom(scale: number): number {
    return Math.min(this.maxZoom, Math.max(this.minZoom, scale));
  }

  protected previewZoom(scale: number): void {
    const a = this.pendingArt() ?? this.art();
    if (a) this.pendingArt.set({ ...a, scale: this.clampZoom(scale) });
  }

  /** Applies the moved placement to the card. */
  protected commitArt(): void {
    const p = this.pendingArt();
    if (!p) return;
    this.pendingArt.set(null);
    this.art.set(p);
  }

  protected wheelZoom(e: WheelEvent): void {
    const a = this.pendingArt() ?? this.art();
    if (!this.framing() || !a) return;
    e.preventDefault();
    this.pendingArt.set({ ...a, scale: this.clampZoom(a.scale * Math.exp(-e.deltaY * 0.0015)) });
    if (this.wheelTimer) clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => this.commitArt(), 400);
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
    const a = this.art();
    if (!this.dragFrom || !a) return;
    // Screen pixels → card pixels.
    const k = 744 / this.preview().nativeElement.clientWidth;
    const { x, y, ax, ay } = this.dragFrom;
    const base = this.pendingArt() ?? a;
    this.pendingArt.set({ ...base, x: ax + (e.clientX - x) * k, y: ay + (e.clientY - y) * k });
  }

  protected dragEnd(): void {
    this.dragFrom = null;
    this.dragging.set(false);
    this.commitArt();
  }
}

/** A file's contents as a data URL. */
function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
