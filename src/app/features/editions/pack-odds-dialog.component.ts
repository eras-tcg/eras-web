import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EditModeService } from '@core/auth/edit-mode.service';
import { apiErrorMessage } from '@core/http/api-error';
import { CardsStore } from '@data/cards/cards.store';
import { Edition, RARITIES } from '@data/editions/edition.model';
import { RARITY_NAMES, cardsByRarity } from '@data/editions/booster-rules';
import { BoxContent, altArtOdds, boxContents, fromPercent, isSubEdition, packOdds, toPercent } from '@data/shop/shop-rules';
import { ShopOdds } from '@data/shop/shop-odds.model';
import { ShopOddsStore } from '@data/shop/shop-odds.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** 0..1 as a percentage, with a decimal for small odds. */
export function percent(p: number): string {
  if (p <= 0) return '0 %';
  return `${(p * 100).toLocaleString('es', { maximumFractionDigits: p < 0.1 ? 2 : 1 })} %`;
}

/** The shop's odds as typed in the editor, one percent field each. */
const ODDS_FIELDS: { key: keyof ShopOdds; label: string }[] = [
  { key: 'foil', label: 'Foil, por carta' },
  { key: 'prism', label: 'Prismática, por carta' },
  { key: 'alt', label: 'Arte alternativo, por carta (si el arte no tiene la suya)' },
  { key: 'boxUpgrade', label: 'Caja de edición: un sobre sube de rareza' },
  { key: 'subEditionBoxUpgrade', label: 'Caja de sub-edición: un sobre sube de rareza' },
];

/**
 * An edition's odds: the chance of each pack type when buying a pack (with what each type brings), what a booster
 * box brings of each type, the finish of each card, and the alternative arts its packs can give. Whoever manages
 * editions edits here, in edit mode, the shop's odds that no edition sets (ShopOdds, the same for every edition).
 */
@Component({
  selector: 'eras-pack-odds-dialog',
  imports: [ModalComponent, AlertComponent, ButtonComponent],
  template: `
    <eras-modal title="Probabilidades" [subtitle]="edition.editionName ?? edition.editionId" size="lg" (closed)="ref.close()">
      <section class="block">
        <h3 class="heading">Al comprar un sobre</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Tipo de sobre</th>
                <th scope="col" class="num">Probabilidad</th>
                @for (r of rarities; track r) {
                  <th scope="col" class="num" [attr.title]="rarityName(r)">{{ r }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of odds; track row.packType) {
                <tr>
                  <th scope="row">{{ row.packType }}</th>
                  <td class="num strong">{{ percent(row.probability) }}</td>
                  @for (r of rarities; track r) {
                    <td class="num">{{ cardsOf(row.packType, r) || '—' }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="note">Las columnas de rareza dicen cuántas cartas de cada una trae ese tipo de sobre.</p>
      </section>

      @if (contents.length) {
        <section class="block">
          <h3 class="heading">Booster box · {{ edition.boxConfig?.totalPacks }} sobres</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Tipo de sobre</th>
                  <th scope="col" class="num">Sobres en la caja</th>
                  <th scope="col">Detalle</th>
                </tr>
              </thead>
              <tbody>
                @for (row of contents; track $index) {
                  <tr>
                    <th scope="row">{{ row.packType }}</th>
                    <td class="num strong">{{ range(row) }}</td>
                    <td>{{ detail(row) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      @if (shop.odds(); as odds) {
        <section class="block">
          <h3 class="heading">Cada carta</h3>
          <div class="table-wrap">
            <table>
              <tbody>
                <tr><th scope="row">Foil</th><td class="num strong">{{ percent(odds.foil) }}</td></tr>
                <tr><th scope="row">Prismática</th><td class="num strong">{{ percent(odds.prism) }}</td></tr>
                @if (contents.length) {
                  <tr>
                    <th scope="row">Caja: un sobre sube de rareza</th>
                    <td class="num strong">{{ percent(sub ? odds.subEditionBoxUpgrade : odds.boxUpgrade) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="note">El acabado de cada carta se sortea aparte, también al fabricarla.</p>
        </section>

        @if (alts().length) {
          <section class="block">
            <h3 class="heading">Artes alternativos</h3>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Carta</th>
                    <th scope="col">Arte</th>
                    <th scope="col" class="num">Por copia de la carta</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of alts(); track row.card.id + row.art.id) {
                    <tr>
                      <th scope="row">
                        <span class="alt-card"><img [src]="row.art.url" alt="" loading="lazy" /> {{ row.card.name }}</span>
                      </th>
                      <td>{{ row.name }}</td>
                      <td class="num strong">{{ percent(row.odds) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="note">Cada vez que sale esa carta de un sobre o una caja, puede salir con ese arte (en cualquier acabado).</p>
          </section>
        }
      }

      @if (editMode.allows('manage_editions')) {
        <!-- Edit mode: the shop's odds, the same for every edition -->
        <section class="block editor">
          <h3 class="heading">Probabilidades de la tienda (todas las ediciones)</h3>
          @if (saveError(); as message) {
            <eras-alert tone="danger">{{ message }}</eras-alert>
          }
          @if (shop.odds(); as odds) {
            <form class="odds-form" (submit)="$event.preventDefault(); save(form)" #form>
              @for (field of fields; track field.key) {
                <label class="odds-field">
                  <span>{{ field.label }}</span>
                  <span class="odds-input">
                    <input type="text" inputmode="decimal" [name]="field.key" [value]="toPercent($any(odds)[field.key])" required />
                    %
                  </span>
                </label>
              }
              <div class="odds-actions">
                <button erasButton size="sm" type="submit" [loading]="saving()">Guardar probabilidades</button>
                @if (saved()) {
                  <span class="note" role="status">Guardadas</span>
                }
              </div>
            </form>
          }
        </section>
      }
    </eras-modal>
  `,
  styles: `
    .block + .block {
      margin-block-start: var(--space-5);
    }
    .heading {
      margin: 0 0 var(--space-2);
      font-family: var(--font-family-base);
      font-size: var(--font-size-md);
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--font-size-sm);
    }
    th,
    td {
      padding: var(--space-2) var(--space-3);
      border-block-end: var(--border-width) solid var(--color-border);
      text-align: start;
      white-space: nowrap;
    }
    thead th {
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .num {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .strong {
      font-weight: var(--font-weight-bold);
    }
    .note {
      margin: var(--space-2) 0 0;
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
    }
    .alt-card {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
    .alt-card img {
      inline-size: 1.75rem;
      aspect-ratio: 63 / 88;
      border-radius: var(--radius-sm);
      object-fit: cover;
    }
    .editor {
      padding-block-start: var(--space-4);
      border-block-start: var(--border-width) solid var(--color-border);
    }
    .odds-form {
      display: grid;
      gap: var(--space-2);
    }
    .odds-field {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      font-size: var(--font-size-sm);
    }
    .odds-input {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--color-text-muted);
    }
    .odds-input input {
      inline-size: 7rem;
      padding: var(--space-1) var(--space-2);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
      font-variant-numeric: tabular-nums;
      text-align: end;
    }
    .odds-actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackOddsDialogComponent {
  protected readonly edition = inject<Edition>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly shop = inject(ShopOddsStore);
  protected readonly editMode = inject(EditModeService);
  private readonly catalog = inject(CardsStore);

  protected readonly sub = isSubEdition(this.edition.editionId);
  protected readonly fields = ODDS_FIELDS;
  protected readonly toPercent = toPercent;
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal<string | null>(null);

  /** The alternative arts this edition's packs can give, with their odds per copy (none for most editions). */
  protected readonly alts = computed(() => {
    const odds = this.shop.odds();
    if (!odds) return [];
    const cards = [...cardsByRarity(this.catalog.cards(), this.edition.editionId).values()].flat();
    return altArtOdds(cards, odds.alt);
  });

  constructor() {
    void this.shop.load();
    void this.catalog.load();
  }

  /** Saves the shop's odds typed in the editor (each a percent from 0 to 100). */
  protected async save(form: HTMLFormElement): Promise<void> {
    this.saveError.set(null);
    this.saved.set(false);
    const data = new FormData(form);
    const odds = {} as ShopOdds;
    for (const field of ODDS_FIELDS) {
      const value = fromPercent(String(data.get(field.key) ?? ''));
      if (value === null) {
        this.saveError.set(`«${field.label}» debe ser un número de 0 a 100 %`);
        return;
      }
      odds[field.key] = value;
    }
    this.saving.set(true);
    try {
      await this.shop.save(odds);
      this.saved.set(true);
    } catch (e) {
      this.saveError.set(apiErrorMessage(e, 'No se pudieron guardar las probabilidades'));
    } finally {
      this.saving.set(false);
    }
  }

  protected readonly rarities = RARITIES;
  protected readonly odds = packOdds(this.edition);
  protected readonly contents = boxContents(this.edition);
  protected readonly percent = percent;
  protected readonly rarityName = (r: string) => RARITY_NAMES[r] ?? r;

  protected cardsOf(packType: string, rarity: (typeof RARITIES)[number]): number {
    return this.edition.packTypes?.find((p) => p.name === packType)?.cardsPerRarity[rarity] ?? 0;
  }

  protected range(row: BoxContent): string {
    return row.min === row.max ? String(row.min) : `${row.min}–${row.max}`;
  }

  protected detail(row: BoxContent): string {
    if (row.options) return row.options.map((o) => `${o.quantity}: ${percent(o.probability)}`).join(' · ');
    return row.min === row.max ? 'Siempre' : 'Completa la caja';
  }
}
