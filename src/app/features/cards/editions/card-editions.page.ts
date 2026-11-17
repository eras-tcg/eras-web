import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CdkMenuTrigger } from '@angular/cdk/menu';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { EditModeService } from '@core/auth/edit-mode.service';
import { CARD_COLORS, CARD_RARITIES, COLOR_LABELS, CatalogCard } from '@data/cards/card.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { openCardDetailDialog } from '../card-detail-dialog/card-detail-dialog.component';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { firstValueFrom } from 'rxjs';
import { CoverFrame, Edition } from '@data/editions/edition.model';
import { EditionSlot, deckSize, editionSlots, reprintOrigins, slotsFilled, slotsForColor } from '@data/editions/edition-slots';
import { isStructure } from '@data/shop/shop-rules';
import { EditionMetricsDialogComponent, EditionMetricsData } from './edition-metrics-dialog.component';
import { EditionCoverData, EditionCoverDialogComponent, EditionCoverResult } from './edition-cover-dialog.component';
import { EditionTileComponent } from './edition-tile.component';
import { CardMoveData, CardMoveDialogComponent } from './card-move-dialog.component';
import { CardRenderService } from '../../admin/card-editor/render/card-render.service';
import { EditionsStore } from '@data/editions/editions.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';

/** What the edition form edits. */
interface EditionForm {
  editionId: string;
  editionName: string;
  colors: string[];
  cardsPerColor: number;
  /** Colors with their own count (white has 5 outside structure decks unless set). */
  cardsByColor: Record<string, number>;
  /** The regulation a new card of the edition starts with. */
  regulation: string;
  editionDescription: string;
  releaseDate: string;
  /** A new cover chosen, saved with the edition. */
  cover: File | null;
  /** How the cover sits in its tile; null: as it is. */
  coverFrame: CoverFrame | null;
}

/**
 * Editions inside Cards: every edition with how many of its slots have a card, and one edition's slots by color
 * (colors × cards per color), each with its card or empty. Whoever manages cards opens a slot in the card editor (a
 * filled one to edit its card, an empty one to make the card of that code); whoever manages editions creates and
 * edits them here.
 */
@Component({
  selector: 'eras-card-editions-page',
  imports: [
    RouterLink,
    PageComponent,
    GridComponent,
    StackComponent,
    SectionHeaderComponent,
    FormFieldComponent,
    AlertComponent,
    ButtonComponent,
    ChipComponent,
    IconComponent,
    CdkMenuTrigger,
    MenuComponent,
    MenuItemDirective,
    EditionTileComponent,
  ],
  template: `
    <eras-page [title]="edition()?.editionName || (editionId() ?? 'Ediciones')" width="wide">
      @if (edition()) {
        <button page-actions erasButton variant="ghost" type="button" (click)="showMetrics()">
          Métricas
        </button>
      }
      @if (canEditEditions() && !form()) {
        <button page-actions erasButton variant="secondary" type="button" (click)="startForm()">
          {{ edition() ? 'Editar edición' : 'Nueva edición' }}
        </button>
      }

      @if (error()) {
        <eras-alert tone="danger">{{ error() }}</eras-alert>
      }

      @if (form(); as f) {
        <eras-stack [gap]="3" class="form">
          @if (!edition()) {
            <eras-form-field label="Código">
              <input
                type="text"
                placeholder="ST2"
                [value]="f.editionId"
                (input)="patch({ editionId: $any($event.target).value.trim().toUpperCase() })"
              />
            </eras-form-field>
          }
          <eras-form-field label="Nombre">
            <input
              type="text"
              [value]="f.editionName"
              (input)="patch({ editionName: $any($event.target).value })"
            />
          </eras-form-field>
          <span class="label">Colores</span>
          <eras-stack direction="row" [gap]="1" wrap>
            @for (c of colors; track c) {
              <button erasChip [selected]="f.colors.includes(c)" (click)="toggleColor(c)">
                {{ colorLabels[c] }}
              </button>
            }
          </eras-stack>
          <eras-form-field label="Cartas por color">
            <input
              type="number"
              min="1"
              [value]="f.cardsPerColor"
              (input)="patch({ cardsPerColor: $any($event.target).valueAsNumber || 0 })"
            />
          </eras-form-field>
          @if (f.colors.length) {
            <span class="label">Cartas de cada color</span>
            <div class="per-color">
              @for (c of colors; track c) {
                @if (f.colors.includes(c)) {
                  <label>
                    <span>{{ colorLabels[c] }}</span>
                    <input
                      type="number"
                      min="0"
                      [value]="colorCount(f, c)"
                      (input)="setColorCount(c, $any($event.target).valueAsNumber)"
                    />
                  </label>
                }
              }
            </div>
          }
          <eras-form-field label="Regulación">
            <input
              type="text"
              maxlength="3"
              [value]="f.regulation"
              (input)="patch({ regulation: $any($event.target).value })"
            />
          </eras-form-field>
          <eras-form-field label="Descripción">
            <textarea
              rows="3"
              [value]="f.editionDescription"
              (input)="patch({ editionDescription: $any($event.target).value })"
            ></textarea>
          </eras-form-field>
          <span class="label">Portada</span>
          <div class="cover">
            <eras-edition-tile
              [image]="coverPreview()"
              [frame]="f.coverFrame ?? edition()?.coverFrame"
              [code]="f.editionId || '—'"
              [name]="f.editionName"
            />
            <button erasButton variant="secondary" type="button" (click)="editCover()">Editar portada</button>
          </div>
          <eras-form-field label="Fecha de lanzamiento">
            <input
              type="date"
              [value]="f.releaseDate"
              (input)="patch({ releaseDate: $any($event.target).value })"
            />
          </eras-form-field>
          <eras-stack direction="row" [gap]="2">
            <button erasButton type="button" [loading]="saving()" [disabled]="saving()" (click)="saveForm()">
              Guardar
            </button>
            <button erasButton variant="ghost" type="button" (click)="form.set(null)">Cancelar</button>
          </eras-stack>
        </eras-stack>
      }

      @if (edition(); as e) {
        <p class="meta">
          {{ e.editionId }} · {{ filled().filled }} de {{ filled().total }} cartas
          @if (structure()) {
            · mazo de {{ deck() }} cartas
          }
          @if (e.editionDescription) {
            · {{ e.editionDescription }}
          }
        </p>
        @for (g of groups(); track g.color) {
          <eras-section-header [title]="colorLabels[g.color] || g.color" />
          <eras-grid minColumn="9rem" [gap]="3">
            <!-- By slot and card: a slot whose card changed (a move) is drawn anew, its menus pointing to the new card -->
            @for (s of g.slots; track s.code + '|' + (s.meta?.id ?? '')) {
              @if (s.meta) {
                <div class="slot-wrap">
                  <div class="slot-card">
                    <!-- Its rarity on a tab over the card's top edge, in the shop's rarity colors; changed from here in edit mode -->
                    @if (canEditCards()) {
                      <button
                        type="button"
                        class="rarity-tab"
                        [style.--rarity]="rarityColor(s.meta.rarity)"
                        [attr.data-rarity]="s.meta.rarity"
                        [attr.aria-label]="'Rareza de ' + s.meta.cardName + ': ' + (s.meta.rarity || 'sin rareza')"
                        title="Cambiar rareza"
                        [disabled]="savingRarity() === s.meta.id"
                        [cdkMenuTriggerFor]="rarityMenu"
                        [cdkMenuTriggerData]="{ $implicit: s }"
                      >
                        {{ s.meta.rarity || '—' }}
                      </button>
                    } @else if (s.meta.rarity) {
                      <span class="rarity-tab" [style.--rarity]="rarityColor(s.meta.rarity)" [attr.data-rarity]="s.meta.rarity" [attr.aria-label]="'Rareza ' + s.meta.rarity">
                        {{ s.meta.rarity }}
                      </span>
                    }
                    <button
                      type="button"
                      class="slot"
                      [attr.aria-label]="s.code + ' ' + s.meta.cardName"
                      (click)="showCard(s)"
                    >
                      @if (slotImage(s); as src) {
                        <img [src]="src" alt="" loading="lazy" />
                      } @else {
                        <span class="name">{{ s.meta.cardName }}</span>
                        <span class="code">{{ s.code }}</span>
                      }
                    </button>
                    @if (!canEditCards() && reprints().get(s.meta.id); as origin) {
                      <!-- A reprint: the reprint icon lit in the corner (Mover's place in edit mode) -->
                      <span class="edit reprint-mark lit" role="img" [attr.aria-label]="'Reimpresión de ' + origin" [title]="'Reimpresión de ' + origin">
                        <eras-icon name="layers" />
                      </span>
                    }
                    @if (canEditCards()) {
                      <button
                        type="button"
                        class="edit"
                        [attr.aria-label]="'Editar ' + s.meta.cardName"
                        (click)="openEditor(s)"
                      >
                        <eras-icon name="edit" />
                      </button>
                      <button
                        type="button"
                        class="edit move"
                        [attr.aria-label]="'Mover ' + s.meta.cardName + ' a otro lugar'"
                        title="Mover a otro lugar"
                        (click)="moveCard(s)"
                      >
                        <eras-icon name="swap" />
                      </button>
                      <button
                        type="button"
                        class="edit reprint"
                        [class.lit]="reprints().has(s.meta.id)"
                        [attr.aria-label]="'Reimprimir ' + s.meta.cardName + ' en otra edición'"
                        [title]="reprints().get(s.meta.id) ? 'Reimpresión de ' + reprints().get(s.meta.id) + ' · Reimprimir en otra edición' : 'Reimprimir en otra edición'"
                        (click)="moveCard(s, 'reprint')"
                      >
                        <eras-icon name="layers" />
                      </button>
                    }
                  </div>
                  @if (structure()) {
                    <div class="copies">
                      @if (canEditCards()) {
                        <button
                          type="button"
                          [attr.aria-label]="'Una copia menos de ' + s.meta.cardName"
                          [disabled]="!(s.meta.deckCopies ?? 0) || savingCopies() === s.meta.id"
                          (click)="setCopies(s, (s.meta.deckCopies ?? 0) - 1)"
                        >
                          −
                        </button>
                      }
                      <span>× {{ s.meta.deckCopies ?? 0 }}</span>
                      @if (canEditCards()) {
                        <button
                          type="button"
                          [attr.aria-label]="'Una copia más de ' + s.meta.cardName"
                          [disabled]="savingCopies() === s.meta.id"
                          (click)="setCopies(s, (s.meta.deckCopies ?? 0) + 1)"
                        >
                          +
                        </button>
                      }
                    </div>
                  }
                </div>
              } @else if (canEditCards()) {
                <button
                  type="button"
                  class="slot empty"
                  [attr.aria-label]="'Crear ' + s.code"
                  (click)="openEditor(s)"
                >
                  <span class="code">{{ s.code }}</span>
                </button>
              } @else {
                <!-- Out of edit mode the empty slot still holds its place in the grid -->
                <div class="slot empty placeholder" role="img" [attr.aria-label]="s.code + ' vacío'">
                  <span class="code">{{ s.code }}</span>
                </div>
              }
            }
          </eras-grid>
        } @empty {
          <p class="meta">Esta edición todavía no tiene colores ni cartas.</p>
        }
        <ng-template #rarityMenu let-s>
          <eras-menu aria-label="Rareza">
            @for (r of rarities; track r) {
              <button erasMenuItem (triggered)="setRarity(s, r)">
                <span class="rarity-dot" [style.--rarity]="rarityColor(r)"></span>{{ r }}
              </button>
            }
          </eras-menu>
        </ng-template>
      } @else if (!editionId()) {
        <eras-grid minColumn="min(12rem, 40vw, 36dvh)" [gap]="4">
          @for (e of list(); track e.edition.editionId) {
            <a class="tile" [routerLink]="['/cards/editions', e.edition.editionId]">
              <eras-edition-tile
                [image]="e.edition.editionImage"
                [frame]="e.edition.coverFrame"
                [code]="e.edition.editionId"
                [name]="e.edition.editionName"
                [detail]="e.filled.filled + ' / ' + e.filled.total"
              />
            </a>
          }
        </eras-grid>
      } @else if (editions.catalogEditions().length) {
        <p class="meta">No existe la edición {{ editionId() }}.</p>
      }
    </eras-page>
  `,
  styles: `
    .form {
      max-inline-size: 32rem;
      margin-block-end: var(--space-5);
    }
    .cover {
      display: grid;
      gap: var(--space-2);
      justify-items: start;
    }
    .cover eras-edition-tile {
      inline-size: 12rem;
    }
    .label,
    .meta {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    /* The tile lifts on hover, as in the shop */
    .tile {
      display: block;
      border-radius: var(--radius-lg);
      color: inherit;
      text-decoration: none;
      transition: transform var(--duration-fast) var(--easing-standard);
    }
    .tile:hover,
    .tile:focus-visible {
      transform: translateY(-3px);
    }
    .tile:hover eras-edition-tile,
    .tile:focus-visible eras-edition-tile {
      border-color: var(--color-hub-accent);
      box-shadow: var(--shadow-lg);
    }
    .slot-card {
      position: relative;
    }
    /* Every slot leaves room above it for the rarity tab, so cards and empty slots stay in line */
    .slot-wrap,
    .slot.empty {
      --rarity-tab-height: 1.5rem;
      margin-block-start: var(--rarity-tab-height);
    }
    /*
     * The rarity tab: flush with the card's right edge, square at its top-right corner, coming down over the card past
     * its rounded corner (no gap shows there) with its label above the card; the left side cut on a slant. Its color is
     * the shop's rarity color as an intense gradient into a deeper neighbouring hue.
     */
    .rarity-tab {
      --corner: var(--radius-md);
      position: absolute;
      /* Behind the card: the part that comes down past its corner is hidden under it */
      z-index: 0;
      inset-block-end: calc(100% - var(--corner) - 2px);
      inset-inline-end: 0;
      display: grid;
      place-items: start center;
      min-inline-size: 3rem;
      block-size: calc(var(--rarity-tab-height, 1.5rem) + var(--corner) + 2px);
      padding: calc((var(--rarity-tab-height, 1.5rem) - 1em) / 2) var(--space-2) 0 calc(var(--space-2) + 0.7rem);
      border: 0;
      background: linear-gradient(135deg, var(--rarity-from) 20%, var(--rarity-to));
      color: var(--color-on-rarity);
      clip-path: polygon(0.8rem 0, 100% 0, 100% 100%, 0 100%);
      font-family: var(--font-family-display);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      line-height: 1;
      text-shadow: 0 1px 2px var(--color-rarity-shade);
    }
    .rarity-tab { --rarity-from: var(--rarity); --rarity-to: color-mix(in srgb, var(--rarity) 60%, var(--color-rarity-shade)); }
    .rarity-tab[data-rarity='UC'] { --rarity-to: color-mix(in srgb, var(--color-rarity-uc) 45%, var(--color-rarity-r)); }
    .rarity-tab[data-rarity='R'] { --rarity-from: var(--color-rarity-r); --rarity-to: color-mix(in srgb, var(--color-rarity-r) 45%, var(--color-rarity-sec)); }
    .rarity-tab[data-rarity='SR'] { --rarity-to: color-mix(in srgb, var(--color-rarity-sr) 55%, var(--color-rarity-sec)); }
    .rarity-tab[data-rarity='SEC'] { --rarity-to: color-mix(in srgb, var(--color-rarity-sec) 40%, var(--color-rarity-r)); }
    button.rarity-tab {
      cursor: pointer;
    }
    button.rarity-tab:hover {
      filter: brightness(1.1);
    }
    .rarity-dot {
      display: inline-block;
      inline-size: 0.75rem;
      block-size: 0.75rem;
      margin-inline-end: var(--space-2);
      border-radius: 50%;
      background: var(--rarity);
    }
    .per-color {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
    .per-color label {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-size: var(--font-size-sm);
    }
    .per-color input {
      inline-size: 5rem;
    }
    .copies {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: var(--space-2);
      margin-block-start: var(--space-1);
      font-size: var(--font-size-sm);
    }
    .copies button {
      inline-size: 1.75rem;
      block-size: 1.75rem;
      border: var(--border-width) solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
    }
    .copies button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .slot-card .slot {
      position: relative;
      z-index: 1;
      inline-size: 100%;
    }
    .edit {
      position: absolute;
      z-index: 2;
      inset-block-end: 6%;
      inset-inline-end: 7%;
      display: grid;
      place-items: center;
      inline-size: 2rem;
      block-size: 2rem;
      border: var(--border-width) solid var(--color-border);
      border-radius: 50%;
      background: color-mix(in srgb, var(--color-surface) 85%, transparent);
      color: var(--color-text);
      cursor: pointer;
    }
    .edit.move {
      inset-inline-end: auto;
      inset-inline-start: 7%;
    }
    /* Reprint sits right above Mover */
    .edit.reprint {
      inset-inline-end: auto;
      inset-inline-start: 7%;
      inset-block-end: calc(6% + 2.5rem);
    }
    .edit:hover {
      background: var(--color-surface);
    }
    .edit eras-icon {
      inline-size: 1rem;
      block-size: 1rem;
    }
    .slot {
      position: relative;
      display: grid;
      place-items: center;
      aspect-ratio: 744 / 1039;
      padding: 0;
      overflow: hidden;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
    }
    .slot:disabled {
      cursor: default;
    }
    /* A reprint: its reprint icon lit (the button in edit mode, the mark in the bottom corner out of it) */
    .reprint-mark {
      inset-inline-end: auto;
      inset-inline-start: 7%;
      cursor: default;
    }
    .edit.lit {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--color-on-primary);
    }
    .slot.placeholder {
      cursor: default;
    }
    .slot.empty {
      border-style: dashed;
      background: transparent;
      color: var(--color-text-muted);
    }
    .slot img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .slot .name {
      padding: var(--space-2);
      text-align: center;
    }
    .slot .code {
      position: absolute;
      inset-block-end: var(--space-1);
      inset-inline: 0;
      text-align: center;
      font-size: var(--font-size-xs, 0.75rem);
      text-shadow: 0 0 3px var(--color-bg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardEditionsPage {
  /** `/cards/editions/:editionId` (bound by the router); absent on the list. */
  readonly editionId = input<string>();

  protected readonly editions = inject(EditionsStore);
  private readonly cards = inject(CardsStore);
  private readonly editMode = inject(EditModeService);
  private readonly router = inject(Router);
  private readonly adminApi = inject(CardsAdminApi);
  private readonly modal = inject(ModalService);
  private readonly renderer = inject(CardRenderService);
  /** The editor's finished images already fetched (they need the session), by card id and render. */
  private readonly renders = signal<Record<string, string>>({});
  private readonly asked = new Set<string>();

  protected readonly colors = CARD_COLORS;
  protected readonly colorLabels = COLOR_LABELS;
  protected readonly canEditCards = computed(() => this.editMode.allows('manage_cards'));
  protected readonly canEditEditions = computed(() => this.editMode.allows('manage_editions'));

  protected readonly form = signal<EditionForm | null>(null);
  /** The cover shown in the form: the one chosen, else the edition's. */
  protected readonly coverPreview = computed(() => {
    const f = this.form();
    if (!f) return null;
    return f.cover ? this.coverUrl() : (this.edition()?.editionImage ?? null) || null;
  });
  private readonly coverUrl = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly edition = computed(() => {
    const id = this.editionId()?.toUpperCase();
    return id ? (this.editions.catalogEditions().find((e) => e.editionId.toUpperCase() === id) ?? null) : null;
  });
  protected readonly groups = computed(() => {
    const e = this.edition();
    return e ? editionSlots(e, this.cards.metaList(), this.cards.cards()) : [];
  });
  protected readonly filled = computed(() => slotsFilled(this.groups()));
  /** The cards printed before under the same name: the code of their first printing. */
  protected readonly reprints = computed(() => reprintOrigins(this.cards.metaList(), this.editions.releaseDates()));
  /** A structure deck (ST…): its cards bring a number of copies each. */
  protected readonly structure = computed(() => isStructure(this.edition()?.editionId ?? ''));
  protected readonly deck = computed(() => deckSize(this.groups()));
  protected readonly savingCopies = signal<string | null>(null);
  protected readonly list = computed(() =>
    this.editions.catalogEditions().map((edition) => ({
      edition,
      filled: slotsFilled(editionSlots(edition, this.cards.metaList())),
    })),
  );

  constructor() {
    void this.editions.load();
    void this.cards.load();
    // The editor's finished images (they show the card's current code), fetched with the session
    effect(() => {
      for (const g of this.groups())
        for (const s of g.slots) {
          const m = s.meta;
          const key = m?.renderKey ? `${m.id}|${m.renderKey}` : null;
          if (!m || !key || this.asked.has(key)) continue;
          this.asked.add(key);
          void firstValueFrom(this.adminApi.render(m.id))
            .then((blob) => this.renders.update((r) => ({ ...r, [key]: URL.createObjectURL(blob) })))
            .catch(() => undefined);
        }
    });
    // Another edition: the form of the last one closes
    effect(() => {
      this.editionId();
      untracked(() => this.form.set(null));
    });
  }

  protected startForm(): void {
    const e = this.edition();
    this.error.set(null);
    this.form.set({
      editionId: e?.editionId ?? '',
      editionName: e?.editionName ?? '',
      colors: [...(e?.colors ?? [])],
      cardsPerColor: e?.cardsPerColor ?? 18,
      cardsByColor: { ...(e?.cardsByColor ?? {}) },
      regulation: e?.regulation ?? '',
      editionDescription: e?.editionDescription ?? '',
      releaseDate: e?.releaseDate ?? '',
      cover: null,
      coverFrame: null,
    });
  }

  protected patch(change: Partial<EditionForm>): void {
    this.form.update((f) => (f ? { ...f, ...change } : f));
  }

  /** Cards of a color in the form: its own count, else the edition's rule (5 white outside structure decks). */
  protected colorCount(f: EditionForm, color: string): number {
    return slotsForColor({ editionId: f.editionId, cardsPerColor: f.cardsPerColor, cardsByColor: f.cardsByColor }, color);
  }

  protected setColorCount(color: string, count: number): void {
    if (!Number.isFinite(count) || count < 0) return;
    this.form.update((f) => (f ? { ...f, cardsByColor: { ...f.cardsByColor, [color]: count } } : f));
  }

  protected toggleColor(c: string): void {
    this.form.update((f) =>
      f ? { ...f, colors: f.colors.includes(c) ? f.colors.filter((x) => x !== c) : [...f.colors, c] } : f,
    );
  }

  /** The cover editor: the image chosen and how it sits stay in the form until it is saved. */
  protected async editCover(): Promise<void> {
    const f = this.form();
    if (!f) return;
    const data: EditionCoverData = {
      code: f.editionId || '—',
      name: f.editionName,
      image: this.coverPreview(),
      frame: f.coverFrame ?? this.edition()?.coverFrame ?? null,
    };
    const ref = this.modal.open<EditionCoverResult, EditionCoverData>(EditionCoverDialogComponent, { data });
    const result = await firstValueFrom(ref.closed);
    if (!result) return;
    if (result.file) {
      const old = this.coverUrl();
      if (old) URL.revokeObjectURL(old);
      this.coverUrl.set(URL.createObjectURL(result.file));
    }
    this.patch({ cover: result.file ?? f.cover, coverFrame: result.frame });
  }

  protected async saveForm(): Promise<void> {
    const f = this.form();
    if (!f) return;
    if (!/^[A-Z]+\d+(?:\.\d+)?$/.test(f.editionId)) {
      this.error.set('El código es letras y número, como ST2 o E1.1');
      return;
    }
    const existing: Edition | null = this.edition();
    if (!existing && this.editions.catalogEditions().some((e) => e.editionId === f.editionId)) {
      this.error.set(`Ya existe la edición ${f.editionId}`);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.editions.save({
        editionId: f.editionId,
        editionName: f.editionName.trim(),
        numberOfCards: f.colors.reduce((n, c) => n + this.colorCount(f, c), 0),
        editionDescription: f.editionDescription.trim(),
        // Empty keeps the image it has
        editionImage: '',
        releaseDate: f.releaseDate,
        packTypes: existing?.packTypes ?? [],
        boxConfig: existing?.boxConfig ?? { totalPacks: 0, entries: [] },
        colors: f.colors,
        cardsPerColor: f.cardsPerColor,
        cardsByColor: Object.fromEntries(f.colors.filter((c) => c in f.cardsByColor).map((c) => [c, f.cardsByColor[c]])),
        regulation: f.regulation.trim().toUpperCase(),
        ...(f.coverFrame ? { coverFrame: f.coverFrame } : {}),
      });
      if (f.cover) await this.editions.setImage(f.editionId, f.cover);
      this.form.set(null);
      if (!existing) void this.router.navigate(['/cards/editions', f.editionId]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar la edición');
    } finally {
      this.saving.set(false);
    }
  }

  /** The slot's picture: the editor's finished image when the card has one (it shows its current code), else Drive's. */
  protected slotImage(s: EditionSlot): string | null {
    const m = s.meta;
    const render = m?.renderKey ? (this.renders()[`${m.id}|${m.renderKey}`] ?? null) : null;
    return render ?? (s.card ? cardImageUrl(s.card) : null);
  }

  /** The edition's cards as the catalog shows them in detail (a card made in the editor shows its finished image). */
  private detailCards(): { slot: EditionSlot; card: CatalogCard }[] {
    return this.groups()
      .flatMap((g) => g.slots)
      .filter((s) => s.meta)
      .map((s) => {
        const m = s.meta!;
        const base: CatalogCard = s.card ?? {
          id: m.id,
          name: m.cardName ?? null,
          edition: m.edition ?? '',
          sub_edition: m.subEdition ?? null,
          number: m.cardNumber ?? null,
          color_identity: m.colorIdentity ?? null,
          image_url: null,
          time_stamp: null,
          meta: m,
        };
        // The picture and data the slot shows: the editor's latest render (already current: no version added), not an
        // older image of the card
        const render = this.slotImage(s);
        const card: CatalogCard = render
          ? { ...base, name: m.cardName ?? base.name, meta: m, image_url: render, time_stamp: null }
          : { ...base, name: m.cardName ?? base.name, meta: m };
        return { slot: s, card };
      });
  }

  /** Saves how many copies of a structure card the deck brings. */
  protected readonly rarities = CARD_RARITIES;
  protected readonly savingRarity = signal<string | null>(null);

  /** A rarity's color in the shop's palette (no rarity: the border's). */
  protected rarityColor(rarity: string | null | undefined): string {
    return rarity ? `var(--color-rarity-${rarity.toLowerCase()})` : 'var(--color-border)';
  }

  /** Saves a card's rarity from its tab (only that field); its finished image, which prints it, is drawn again. */
  protected async setRarity(s: EditionSlot, rarity: string): Promise<void> {
    const m = s.meta;
    if (!m || m.rarity === rarity) return;
    this.savingRarity.set(m.id);
    this.error.set(null);
    try {
      const saved = await firstValueFrom(this.adminApi.setRarity(m.id, rarity));
      this.cards.replaceMeta(saved);
      if (saved.artKey && saved.design) this.cards.replaceMeta(await this.renderer.refresh(saved));
    } catch {
      this.error.set('No se pudo guardar la rareza');
    } finally {
      this.savingRarity.set(null);
    }
  }

  protected async setCopies(s: EditionSlot, copies: number): Promise<void> {
    const m = s.meta;
    if (!m || copies < 0) return;
    this.savingCopies.set(m.id);
    this.error.set(null);
    try {
      this.cards.replaceMeta(await firstValueFrom(this.adminApi.setDeckCopies(m.id, copies)));
    } catch {
      this.error.set('No se pudieron guardar las copias');
    } finally {
      this.savingCopies.set(null);
    }
  }

  /** The edition's card counts (rarity, level, type) in a dialog. */
  protected showMetrics(): void {
    const e = this.edition();
    if (!e) return;
    const metas = this.groups().flatMap((g) => g.slots.filter((s) => s.meta).map((s) => s.meta!));
    const data: EditionMetricsData = {
      title: `Métricas · ${e.editionName || e.editionId}`,
      metas,
      structure: this.structure(),
    };
    this.modal.open(EditionMetricsDialogComponent, { data });
  }

  /** A card's detail, read only, as in Cards (←/→ go through the edition's cards). */
  protected showCard(s: EditionSlot): void {
    const all = this.detailCards();
    const index = all.findIndex((x) => x.slot.code === s.code);
    openCardDetailDialog(this.modal, all.map((x) => x.card), Math.max(0, index));
  }

  /**
   * Moves the slot's card to another slot of its color (a chain of moves when the chosen slot has a card), or
   * reprints it in an empty one.
   */
  protected moveCard(s: EditionSlot, mode: 'move' | 'reprint' = 'move'): void {
    if (!this.canEditCards() || !s.meta) return;
    this.modal.open<boolean, CardMoveData>(CardMoveDialogComponent, { data: { card: s.meta, mode }, maxWidth: '96vw' });
  }

  /** The editor: a filled slot's card, or a new card with an empty slot's code. */
  protected openEditor(s: EditionSlot): void {
    if (!this.canEditCards()) return;
    void this.router.navigate(['/card-editor'], {
      queryParams: s.meta ? { card: s.meta.id } : { slot: s.code },
    });
  }
}
