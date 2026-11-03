import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Edition, RARITIES } from '@data/editions/edition.model';
import { RARITY_NAMES } from '@data/editions/booster-rules';
import { BoxContent, boxContents, packOdds } from '@data/shop/shop-rules';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** 0..1 as a percentage, with a decimal for small odds. */
export function percent(p: number): string {
  if (p <= 0) return '0 %';
  return `${(p * 100).toLocaleString('es', { maximumFractionDigits: p < 0.1 ? 2 : 1 })} %`;
}

/**
 * An edition's odds: the chance of each pack type when buying a pack (with what each type brings), and what a
 * booster box brings of each type.
 */
@Component({
  selector: 'eras-pack-odds-dialog',
  imports: [ModalComponent],
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackOddsDialogComponent {
  protected readonly edition = inject<Edition>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);

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
