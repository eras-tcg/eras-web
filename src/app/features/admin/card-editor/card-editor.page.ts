import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  untracked,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EditionsStore } from '@data/editions/editions.store';
import { otherPrintings, printingPayload } from '@data/editions/edition-slots';
import { CardRenderService } from './render/card-render.service';
import { AppScreen } from '@core/pwa/app-screen';
import { CardsStore } from '@data/cards/cards.store';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ChoiceDialogComponent, ChoiceDialogData } from '@ui/surfaces/choice-dialog/choice-dialog.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
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
  columnRun,
  fitArt,
  parseSlotCode,
  readDesign,
  regionBox,
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
    RouterLink,
    IconComponent,
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
    <div class="top">
      @if (back(); as b) {
        <a class="round" [routerLink]="b.route" [attr.aria-label]="'Volver a ' + b.label">
          <eras-icon name="chevron-left" />
        </a>
      }
      <h1 class="sr-only">Editor de cartas</h1>
      @if (fullscreenToggle) {
        <button
          type="button"
          class="round"
          role="switch"
          [attr.aria-checked]="fullscreen()"
          [attr.aria-label]="fullscreen() ? 'Salir de pantalla completa' : 'Pantalla completa'"
          (click)="toggleFullscreen()"
        >
          <eras-icon [name]="fullscreen() ? 'minimize' : 'maximize'" />
        </button>
      }
    </div>

    <div class="layout">
      <div class="stage" [class.with-art]="!!art()">
        @if (art(); as a) {
          <div class="stage-top">
            <button erasChip [selected]="framing()" (click)="toggleFraming()">
              Encuadrar arte
            </button>
          </div>
          @if (framing()) {
            <input
              class="slider vertical"
              type="range"
              aria-label="Posición vertical del arte"
              min="-1039"
              max="1039"
              step="1"
              [value]="a.y"
              (input)="previewMove('y', $any($event.target).valueAsNumber)"
              (change)="commitArt()"
            />
            <input
              class="slider zoom"
              type="range"
              aria-label="Zoom del arte"
              min="0"
              max="1"
              step="0.001"
              [value]="zoomToSlider(a.scale)"
              (input)="previewZoom(sliderToZoom($any($event.target).valueAsNumber))"
              (change)="commitArt()"
            />
            <input
              class="slider horizontal"
              type="range"
              aria-label="Posición horizontal del arte"
              min="-744"
              max="744"
              step="1"
              [value]="a.x"
              (input)="previewMove('x', $any($event.target).valueAsNumber)"
              (change)="commitArt()"
            />
            <button
              erasButton
              class="fit"
              variant="secondary"
              size="sm"
              type="button"
              [loading]="fitting()"
              [disabled]="fitting()"
              (click)="fitArtToFrame()"
            >
              Ajustar
            </button>
          }
        }
        <div
          #viewport
          class="viewport"
          [class.panning]="panning()"
          (pointerdown)="panStart($event)"
          (pointermove)="panMove($event)"
          (pointerup)="panEnd()"
          (pointercancel)="panEnd()"
          [style.--zoom]="viewZoom()"
        >
          <div class="viewport-inner">
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
                @if (framing() && artCenter(); as c) {
                  <div class="cross" [style.left.%]="c.left" [style.top.%]="c.top">
                    @for (n of nudges; track n.label) {
                      <button
                        type="button"
                        [class]="'cross-' + n.at"
                        [attr.aria-label]="n.label"
                        (click)="n.at === 'mid' ? centerArt() : nudgeArt(n.dx, n.dy)"
                      >
                        {{ n.icon }}
                      </button>
                    }
                  </div>
                }
            </div>
          </div>
        </div>
      </div>

      <eras-stack [gap]="3" class="panel">
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
        @if (art()) {
          <eras-stack direction="row" [gap]="2" wrap>
            <button erasButton variant="ghost" size="sm" type="button" (click)="removeArt()">
              Quitar arte
            </button>
          </eras-stack>
        }

        <eras-section-header title="Vista" />
        <label class="view-zoom"
          >Acercar
          <input
            type="range"
            min="1"
            max="4"
            step="0.25"
            [value]="viewZoom()"
            (input)="viewZoom.set($any($event.target).valueAsNumber)"
          />
          {{ viewZoom() * 100 }} %
        </label>
        @if (sizes().length) {
          <span class="note">Texto de efecto: {{ sizes() }}</span>
        }
      </eras-stack>
    </div>
  `,
  styles: `
    /* The whole window, without page scroll: the card on the left, the options on the right. */
    :host {
      position: fixed;
      inset: 0;
      z-index: 1;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4) var(--space-3);
      background: var(--color-bg);
      overflow: hidden;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .round {
      display: grid;
      place-items: center;
      inline-size: 2.5rem;
      block-size: 2.5rem;
      border: var(--border-width) solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text-muted);
      cursor: pointer;
    }
    .round:hover {
      color: var(--color-text);
    }
    .round eras-icon {
      inline-size: 1.2rem;
      block-size: 1.2rem;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 22rem;
      gap: var(--space-5);
      min-block-size: 0;
    }
    .panel {
      overflow: auto;
      min-block-size: 0;
      padding-inline-end: var(--space-1);
    }
    /* The card's area: its controls on the edges (outside the scroll), the card in the viewport between them. */
    .stage {
      display: grid;
      grid-template-columns: 2.5rem minmax(0, 1fr) minmax(2.5rem, auto);
      grid-template-rows: auto minmax(0, 1fr) 2rem;
      grid-template-areas: 'top top top' 'v view zoom' '. h fit';
      gap: var(--space-2);
      min-block-size: 0;
    }
    .stage-top {
      grid-area: top;
      justify-self: center;
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
    .fit {
      grid-area: fit;
      justify-self: end;
      align-self: center;
    }
    .slider.horizontal {
      grid-area: h;
      inline-size: 100%;
      align-self: center;
    }
    .viewport {
      grid-area: view;
      container-type: size;
      overflow: auto;
      min-block-size: 0;
    }
    .viewport.panning {
      cursor: grabbing;
    }
    .viewport-inner {
      display: grid;
      place-items: safe center;
      min-inline-size: 100%;
      min-block-size: 100%;
      inline-size: max-content;
    }
    /* The card fits the viewport at 100 %, and grows from there. */
    .card-wrap {
      position: relative;
      inline-size: calc(min(100cqi, 100cqb * 744 / 1039) * var(--zoom, 1));
    }
    .slider {
      margin: 0;
    }
    .cross {
      position: absolute;
      z-index: 3;
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
  host: {
    '(document:fullscreenchange)': 'fullscreen.set(!!document.fullscreenElement)',
    '(window:beforeunload)': 'warnBeforeLeaving($event)',
  },
})
export class CardEditorPage {
  /** `?card=<metadata id>`: opens that card (from an edition's slot). */
  readonly card = input<string>();
  /** `?slot=ST2-G05`: a new card with that code (an edition's empty slot). */
  readonly slot = input<string>();
  protected readonly store = inject(CardsStore);
  private readonly api = inject(CardsAdminApi);
  protected readonly fb = feedbackState();
  private readonly preview = viewChild.required<ElementRef<HTMLElement>>('preview');
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly document = inject(DOCUMENT);
  /** Where "back" leads (the screen tree's parent of the editor). */
  private readonly editions = inject(EditionsStore);
  private readonly modal = inject(ModalService);
  private readonly renderer = inject(CardRenderService);
  /** The card as last opened or saved (form and design): leaving with something else asks first. */
  private savedKey = '';
  /** "Back": the edition of the card open (its slots), or the editions when it has none. */
  protected readonly back = computed(() => {
    const id = this.form().edition.trim().toUpperCase();
    const e = id ? this.editions.catalogEditions().find((x) => x.editionId.toUpperCase() === id) : null;
    return e
      ? { route: `/cards/editions/${e.editionId}`, label: e.editionName || e.editionId }
      : { route: '/cards/editions', label: 'Ediciones' };
  });
  /** The last preview drawn (screen colors): what is saved as the card's finished image. */
  private lastPreview: Promise<HTMLCanvasElement> | null = null;
  protected readonly fullscreenToggle = inject(AppScreen).fullscreenToggle;
  protected readonly fullscreen = signal(!!this.document.fullscreenElement);
  /** The card is being dragged around inside its viewport (seen closer, not framing the art). */
  protected readonly panning = signal(false);
  private panFrom: { x: number; y: number; left: number; top: number } | null = null;
  private panPointer = 0;

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
    this.markSaved();
    void this.store.load();
    void this.editions.load();
    void this.loadAssets();
    // A card or a slot asked for in the address, once the cards are loaded
    let handled = '';
    effect(() => {
      const card = this.card();
      const code = this.slot();
      const metas = this.store.metaList();
      const key = `${card ?? ''}|${code ?? ''}`;
      if (key === handled || key === '|') return;
      if (card) {
        const m = metas.find((x) => x.id === card);
        if (!m) return;
        handled = key;
        untracked(() => void this.openCard(m));
      } else if (code) {
        // A new card in an empty slot starts with its edition's regulation (once the editions are loaded)
        const editions = this.editions.catalogEditions();
        if (!editions.length) return;
        const slot = parseSlotCode(code);
        handled = key;
        const regulation = editions.find((e) => e.editionId.toUpperCase() === slot?.edition)?.regulation ?? '';
        if (slot)
          untracked(() =>
            this.reset({ ...blankMeta(slot.edition), regulation, colors: [slot.color], colorIdentity: slot.color, cardNumber: slot.number }),
          );
      }
    });
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
    const shown = baking
      .then(() => svgToCanvasFine(r.svg))
      .then((canvas) => convertCanvas(canvas, (px) => lut.forward(px)));
    this.lastPreview = shown;
    void shown
      .then((canvas) => {
        if (gen === this.generation) host.replaceChildren(canvas);
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
    this.markSaved();
  }

  private stateKey(): string {
    return JSON.stringify({ form: this.form(), design: this.design() });
  }

  private markSaved(): void {
    this.savedKey = this.stateKey();
  }

  /** Something changed since the card was opened or saved. */
  private dirty(): boolean {
    return this.artChanged || this.stateKey() !== this.savedKey;
  }

  /** Used by the route's canDeactivate guard: with unsaved changes it asks whether to save or leave them. */
  async confirmLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    const data: ChoiceDialogData = {
      title: 'Hay cambios sin guardar',
      options: [
        { value: 'save', label: 'Guardar y salir' },
        { value: 'discard', label: 'Salir sin guardar' },
      ],
    };
    const choice = await firstValueFrom(this.modal.open<string | null>(ChoiceDialogComponent, { data }).closed);
    if (choice === 'discard') return true;
    if (choice !== 'save') return false;
    await this.save();
    return !this.dirty();
  }

  protected warnBeforeLeaving(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
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
    this.markSaved();
    if (!m.artKey) return;
    try {
      const blob = await firstValueFrom(this.api.art(m.id));
      if (this.metaId() !== m.id) return;
      // Its art as saved is not a change
      this.loadArt(await dataUrl(blob), design.art ?? { scale: 1, x: 0, y: 0 }, () => this.markSaved());
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

  /** The finished card (the preview as drawn now) as the card's cached image. */
  private async saveRender(id: string): Promise<void> {
    const shown = this.lastPreview;
    if (!shown) return;
    const canvas = await shown;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (blob) await firstValueFrom(this.api.setRender(id, blob));
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
      // Its other printings (reprints), by the name it had before this save
      const before = id ? this.store.metaList().find((m) => m.id === id) : null;
      const printings = before ? otherPrintings(before.cardName, id, this.store.metaList()) : [];
      const art = this.artChanged ? { file: this.artFile } : null;
      const saved = await firstValueFrom(
        id ? this.api.updateMeta(id, body) : this.api.createMeta(body),
      );
      this.metaId.set(saved.id);
      if (art) {
        await firstValueFrom(art.file ? this.api.setArt(saved.id, art.file) : this.api.removeArt(saved.id));
        this.artChanged = false;
        this.artFile = null;
      }
      await this.saveRender(saved.id);
      this.markSaved();
      const synced = printings.length ? await this.syncPrintings(printings, body, art) : 0;
      this.fb.ok(synced ? `Carta guardada y aplicada a ${synced} ${synced === 1 ? 'reimpresión' : 'reimpresiones'}` : 'Carta guardada');
      void this.store.load(true);
    } catch (e) {
      this.fb.fail(e, 'No se pudo guardar la carta');
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Asks whether the change goes to the card's reprints too; if so each takes the card (and the art, when it changed)
   * keeping its own slot, rarity and regulation, and its finished image is drawn again with its code. Answers how many.
   */
  private async syncPrintings(
    printings: CardMeta[],
    body: Omit<CardMeta, 'id'>,
    art: { file: Blob | null } | null,
  ): Promise<number> {
    const codes = printings
      .map((p) => `${p.edition}${p.subEdition ? '.' + p.subEdition : ''}-${p.colorIdentity}${String(p.cardNumber).padStart(2, '0')}`)
      .join(', ');
    const apply = await this.modal.confirm({
      title: 'Reimpresiones',
      message: `Esta carta también está en ${codes}. ¿Aplicar los cambios a ${printings.length === 1 ? 'esa impresión' : 'esas impresiones'}?`,
      confirmLabel: 'Aplicar',
    });
    if (!apply) return 0;
    for (const p of printings) {
      let meta = await firstValueFrom(this.api.updateMeta(p.id, printingPayload(body, p)));
      if (art) meta = await firstValueFrom(art.file ? this.api.setArt(p.id, art.file) : this.api.removeArt(p.id));
      if (meta.artKey && meta.design) await this.renderer.refresh(meta);
    }
    return printings.length;
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
    // A new image starts fitted to the frame's window (as Ajustar does)
    this.loadArt(await dataUrl(file), { scale: 1, x: 0, y: 0 }, () => void this.fitArtToFrame());
  }

  /** Shows an art (as a data URL) with its framing. */
  private loadArt(src: string, place: { scale: number; x: number; y: number }, loaded?: () => void): void {
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
      loaded?.();
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

  /**
   * The zoom slider goes on a log scale: every stretch of it multiplies the zoom by the same ratio, so it grows evenly
   * and slowly (a linear one jumps from small to big). 0 is minZoom, 1 is maxZoom.
   */
  protected sliderToZoom(t: number): number {
    return this.minZoom * Math.pow(this.maxZoom / this.minZoom, t);
  }

  protected zoomToSlider(scale: number): number {
    return Math.log(this.clampZoom(scale) / this.minZoom) / Math.log(this.maxZoom / this.minZoom);
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

  /** How much closer the card is seen (1: as it fits the pane). */
  protected readonly viewZoom = signal(1);
  protected readonly fitting = signal(false);
  /** Small moves of the art, in card pixels. */
  protected readonly nudges = [
    { at: 'up', icon: '↑', label: 'Mover el arte hacia arriba', dx: 0, dy: -2 },
    { at: 'left', icon: '←', label: 'Mover el arte a la izquierda', dx: -2, dy: 0 },
    { at: 'mid', icon: '•', label: 'Centrar el arte', dx: 0, dy: 0 },
    { at: 'right', icon: '→', label: 'Mover el arte a la derecha', dx: 2, dy: 0 },
    { at: 'down', icon: '↓', label: 'Mover el arte hacia abajo', dx: 0, dy: 2 },
  ];

  protected previewMove(axis: 'x' | 'y', value: number): void {
    const a = this.pendingArt() ?? this.art();
    if (a) this.pendingArt.set({ ...a, [axis]: value });
  }

  protected nudgeArt(dx: number, dy: number): void {
    this.art.update((a) => (a ? { ...a, x: a.x + dx, y: a.y + dy } : a));
  }

  /** The art's window of the frame drawn now ([x0, y0, x1, y1] in card pixels), once found. */
  private readonly artWindow = signal<{ key: string; box: Box; clear: [number, number] } | null>(null);
  /** Where the cross of moves goes: the middle of the art's window, in % of the card. */
  protected readonly artCenter = computed(() => {
    const w = this.artWindow();
    if (!w || w.key !== this.frameKey()) return null;
    // Across, the window's middle; down, the middle of the art seen unbroken there (above the boxes in semi and full).
    const [x0, , x1] = w.box;
    const [c0, c1] = w.clear;
    return { left: ((x0 + x1) / 2 / 744) * 100, top: ((c0 + c1) / 2 / 1039) * 100 };
  });
  /** What decides the art's window: the frame and everything that changes its shape. */
  private readonly frameKey = computed(() => {
    const f = this.form();
    return [f.cardType, f.enlace, this.her() || f.inheritEffects.length > 0, this.style(), this.noCost(),
      this.noStrength(), this.goldBorder()].join('|');
  });

  private readonly findWindow = effect(() => {
    const key = this.frameKey();
    if (!this.art() || !this.templates() || this.fontCss() === null) return;
    if (this.artWindow()?.key === key) return;
    void this.measureWindow(key);
  });

  private async measureWindow(key: string): Promise<Box> {
    const known = this.artWindow();
    if (known?.key === key) return known.box;
    const found = await this.probeWindow();
    if (key === this.frameKey()) this.artWindow.set({ key, ...found });
    return found.box;
  }

  /**
   * Sizes the art to the space this card's frame leaves for it (the window found by probeWindow), covering it,
   * centered.
   */
  protected async fitArtToFrame(): Promise<void> {
    const a = this.art();
    if (!a) return;
    this.fitting.set(true);
    try {
      const box = await this.measureWindow(this.frameKey());
      const fit = fitArt(a, box);
      this.art.set({ ...a, ...fit, scale: this.clampZoom(fit.scale) });
    } catch (e) {
      this.fb.fail(e, 'No se pudo ajustar el arte');
    } finally {
      this.fitting.set(false);
    }
  }

  /**
   * The card is drawn with a plain magenta art and the region of that color seen from the art's middle gives the
   * window: the standard frame's opening, nearly the whole card in semi and full art.
   */
  private async probeWindow(): Promise<{ box: Box; clear: [number, number] }> {
    const templates = this.templates();
    const css = this.fontCss();
    if (!templates || css === null) throw new Error('Plantillas sin cargar');
    {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      const pc = probe.getContext('2d')!;
      pc.fillStyle = '#ff00ff';
      pc.fillRect(0, 0, 1, 1);
      const draft = {
        ...draftFromForm(this.form(), this.her()),
        noCost: this.noCost(),
        noStrength: this.noStrength(),
        goldBorder: this.goldBorder(),
        frameStyle: this.style(),
        art: { src: probe.toDataURL(), width: 1, height: 1, scale: 1, x: 0, y: 0 },
      };
      const r = new SvgRenderer(buildCard(draft, templates, this.measure), css);
      r.render();
      const canvas = await svgToCanvasFine(r.svg, 1);
      const { width, height } = canvas;
      const data = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
      const magenta = (red: number, g: number, b: number) => red > 200 && g < 70 && b > 200;
      // Seed: the art's middle, above the name bar of every frame.
      const seed: [number, number] = [Math.round(width / 2), Math.round(height * 0.3)];
      const box = regionBox(data, width, height, seed, magenta);
      if (!box) throw new Error('No se encontró el espacio del arte');
      const [c0, c1] = columnRun(data, width, height, seed, magenta);
      const k = 744 / width;
      return { box: [box[0] * k, box[1] * k, box[2] * k, box[3] * k], clear: [c0 * k, c1 * k] };
    }
  }

  protected async toggleFullscreen(): Promise<void> {
    try {
      if (this.document.fullscreenElement) await this.document.exitFullscreen();
      else await this.document.documentElement.requestFullscreen();
    } catch {
      // The browser refused it (no user gesture, not allowed): nothing changes
    }
  }

  /**
   * Seen closer (and not framing the art), dragging anywhere on the card moves it inside its viewport. The drag starts
   * only once the pointer has moved a little, so clicks on the card's parts still reach them.
   */
  protected panStart(e: PointerEvent): void {
    if (this.viewZoom() <= 1 || this.framing() || e.button !== 0) return;
    const v = this.viewport().nativeElement;
    this.panFrom = { x: e.clientX, y: e.clientY, left: v.scrollLeft, top: v.scrollTop };
    this.panPointer = e.pointerId;
  }

  protected panMove(e: PointerEvent): void {
    const from = this.panFrom;
    if (!from) return;
    const v = this.viewport().nativeElement;
    if (!this.panning()) {
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < 4) return;
      v.setPointerCapture(this.panPointer);
      this.panning.set(true);
    }
    v.scrollLeft = from.left - (e.clientX - from.x);
    v.scrollTop = from.top - (e.clientY - from.y);
  }

  protected panEnd(): void {
    this.panFrom = null;
    this.panning.set(false);
  }

  /** Framing (or with the card at its normal size), dragging the card moves the art. */
  protected dragStart(e: PointerEvent): void {
    if (this.viewZoom() > 1 && !this.framing()) return;
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

/** A box on the card: [x0, y0, x1, y1] in card pixels. */
type Box = [number, number, number, number];
