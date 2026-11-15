import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EditModeService } from '@core/auth/edit-mode.service';
import { CARD_COLORS, COLOR_LABELS, CatalogCard } from '@data/cards/card.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { openCardDetailDialog } from '../card-detail-dialog/card-detail-dialog.component';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { firstValueFrom } from 'rxjs';
import { Edition } from '@data/editions/edition.model';
import { EditionSlot, editionMetrics, editionSlots, slotsFilled } from '@data/editions/edition-slots';
import { EditionMetricsDialogComponent, EditionMetricsData } from './edition-metrics-dialog.component';
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
  editionDescription: string;
  releaseDate: string;
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
          <eras-form-field label="Descripción">
            <textarea
              rows="3"
              [value]="f.editionDescription"
              (input)="patch({ editionDescription: $any($event.target).value })"
            ></textarea>
          </eras-form-field>
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
          @if (e.editionDescription) {
            · {{ e.editionDescription }}
          }
        </p>
        @for (g of groups(); track g.color) {
          <eras-section-header [title]="colorLabels[g.color] || g.color" />
          <eras-grid minColumn="9rem" [gap]="3">
            @for (s of g.slots; track s.code) {
              @if (s.meta) {
                <div class="slot-wrap">
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
                  @if (canEditCards()) {
                    <button
                      type="button"
                      class="edit"
                      [attr.aria-label]="'Editar ' + s.meta.cardName"
                      (click)="openEditor(s)"
                    >
                      <eras-icon name="edit" />
                    </button>
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
              }
            }
          </eras-grid>
        } @empty {
          <p class="meta">Esta edición todavía no tiene colores ni cartas.</p>
        }
      } @else if (!editionId()) {
        <eras-grid minColumn="14rem" [gap]="3">
          @for (e of list(); track e.edition.editionId) {
            <a class="tile" [routerLink]="['/cards/editions', e.edition.editionId]">
              <span class="code">{{ e.edition.editionId }}</span>
              <span class="title">{{ e.edition.editionName || e.edition.editionId }}</span>
              <span class="count">{{ e.filled.filled }} / {{ e.filled.total }}</span>
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
    .label,
    .meta {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .tile {
      display: grid;
      gap: var(--space-1);
      padding: var(--space-4);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      text-decoration: none;
    }
    .tile:hover {
      border-color: var(--color-hub-accent);
    }
    .tile .code,
    .tile .count {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .tile .title {
      font-weight: var(--font-weight-bold, 700);
    }
    .slot-wrap {
      position: relative;
    }
    .slot-wrap .slot {
      inline-size: 100%;
    }
    .edit {
      position: absolute;
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
  /** The editor's finished images already fetched (they need the session), by card id and render. */
  private readonly renders = signal<Record<string, string>>({});
  private readonly asked = new Set<string>();

  protected readonly colors = CARD_COLORS;
  protected readonly colorLabels = COLOR_LABELS;
  protected readonly canEditCards = computed(() => this.editMode.allows('manage_cards'));
  protected readonly canEditEditions = computed(() => this.editMode.allows('manage_editions'));

  protected readonly form = signal<EditionForm | null>(null);
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
  protected readonly list = computed(() =>
    this.editions.catalogEditions().map((edition) => ({
      edition,
      filled: slotsFilled(editionSlots(edition, this.cards.metaList())),
    })),
  );

  constructor() {
    void this.editions.load();
    void this.cards.load();
    // The editor's finished images of the cards without a Drive image, fetched with the session
    effect(() => {
      for (const g of this.groups())
        for (const s of g.slots) {
          const m = s.meta;
          const key = m?.renderKey ? `${m.id}|${m.renderKey}` : null;
          if (!m || !key || (s.card && cardImageUrl(s.card)) || this.asked.has(key)) continue;
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
      editionDescription: e?.editionDescription ?? '',
      releaseDate: e?.releaseDate ?? '',
    });
  }

  protected patch(change: Partial<EditionForm>): void {
    this.form.update((f) => (f ? { ...f, ...change } : f));
  }

  protected toggleColor(c: string): void {
    this.form.update((f) =>
      f ? { ...f, colors: f.colors.includes(c) ? f.colors.filter((x) => x !== c) : [...f.colors, c] } : f,
    );
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
        numberOfCards: f.colors.length * f.cardsPerColor,
        editionDescription: f.editionDescription.trim(),
        // Empty keeps the image it has
        editionImage: '',
        releaseDate: f.releaseDate,
        packTypes: existing?.packTypes ?? [],
        boxConfig: existing?.boxConfig ?? { totalPacks: 0, entries: [] },
        colors: f.colors,
        cardsPerColor: f.cardsPerColor,
      });
      this.form.set(null);
      if (!existing) void this.router.navigate(['/cards/editions', f.editionId]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar la edición');
    } finally {
      this.saving.set(false);
    }
  }

  /** The slot's picture: its Drive image, else the editor's finished image. */
  protected slotImage(s: EditionSlot): string | null {
    const drive = s.card ? cardImageUrl(s.card) : null;
    if (drive) return drive;
    const m = s.meta;
    return m?.renderKey ? (this.renders()[`${m.id}|${m.renderKey}`] ?? null) : null;
  }

  /** The edition's cards as the catalog shows them in detail (a card made in the editor shows its finished image). */
  private detailCards(): { slot: EditionSlot; card: CatalogCard }[] {
    return this.groups()
      .flatMap((g) => g.slots)
      .filter((s) => s.meta)
      .map((s) => {
        const m = s.meta!;
        const card: CatalogCard = s.card ?? {
          id: m.id,
          name: m.cardName ?? null,
          edition: m.edition ?? '',
          sub_edition: m.subEdition ?? null,
          number: m.cardNumber ?? null,
          color_identity: m.colorIdentity ?? null,
          image_url: this.slotImage(s),
          time_stamp: null,
          meta: m,
        };
        return { slot: s, card };
      });
  }

  /** The edition's card counts (rarity, level, type) in a dialog. */
  protected showMetrics(): void {
    const e = this.edition();
    if (!e) return;
    const metas = this.groups().flatMap((g) => g.slots.filter((s) => s.meta).map((s) => s.meta!));
    const data: EditionMetricsData = { title: `Métricas · ${e.editionName || e.editionId}`, metrics: editionMetrics(metas) };
    this.modal.open(EditionMetricsDialogComponent, { data });
  }

  /** A card's detail, read only, as in Cards (←/→ go through the edition's cards). */
  protected showCard(s: EditionSlot): void {
    const all = this.detailCards();
    const index = all.findIndex((x) => x.slot.code === s.code);
    openCardDetailDialog(this.modal, all.map((x) => x.card), Math.max(0, index));
  }

  /** The editor: a filled slot's card, or a new card with an empty slot's code. */
  protected openEditor(s: EditionSlot): void {
    if (!this.canEditCards()) return;
    void this.router.navigate(['/card-editor'], {
      queryParams: s.meta ? { card: s.meta.id } : { slot: s.code },
    });
  }
}
