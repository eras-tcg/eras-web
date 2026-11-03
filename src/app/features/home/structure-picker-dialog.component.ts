import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProgressionStore, STRUCTURE_STEP } from '@core/missions/progression.store';
import { WalletStore } from '@core/wallet/wallet.store';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { DecksStore } from '@data/decks/decks.store';
import { Edition } from '@data/editions/edition.model';
import { EditionsStore } from '@data/editions/editions.store';
import { structureDeck, structureList, structureLore, structureStyle } from '@data/missions/structure-decks';
import { isStructure } from '@data/shop/shop-rules';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../cards/card-detail-dialog/card-detail-dialog.component';

/**
 * The "Elige tu structure deck" step: the covers of the structure decks not owned yet; one opens its philosophy, its
 * story and its card list (a card opens its detail). Choosing one (after confirming) claims the step, which gives
 * it free, and closes with its edition id so the caller can open it.
 */
@Component({
  selector: 'eras-structure-picker-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent, AlertComponent, GridComponent, CardThumbComponent, SpinnerComponent],
  template: `
    <eras-modal [title]="current() ? (current()!.editionName ?? current()!.editionId) : 'Elige tu structure deck'" [subtitle]="subtitle()" size="xl" (closed)="ref.close()">
      @if (progression.error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      @if (current(); as edition) {
        <div class="detail">
          <img class="cover" [src]="edition.editionImage" [alt]="'Portada de ' + (edition.editionName ?? edition.editionId)" />
          <div class="about">
            @if (style(edition); as s) {
              <p class="color">{{ edition.editionId }} · Identidad {{ s.color }}</p>
              <p class="tagline">{{ s.tagline }}</p>
              <p>{{ s.philosophy }}</p>
              <p class="tags">
                @for (t of s.tags; track t) {
                  <span class="tag">{{ t }}</span>
                }
              </p>
            }
            @if (lore(edition.editionDescription); as story) {
              <p class="lore">{{ story }}</p>
            }
          </div>
        </div>
        <h3 class="list-title">Lista del mazo · {{ total() }} cartas</h3>
        @if (list().length === 0) {
          <eras-spinner />
        } @else {
          <eras-grid minColumn="min(7rem, 26vw)" [gap]="2">
            @for (entry of list(); track entry.card.id) {
              <eras-card-thumb [name]="entry.card.name ?? ''" [imageUrl]="imageUrl(entry.card)" [count]="entry.copies" showSingleCount (selected)="openCard(entry.card)" />
            }
          </eras-grid>
        }
      } @else {
        @if (replay) {
          <p class="intro">Ya elegiste tu structure deck gratis. Aquí puedes volver a mirarlos todos; los demás están en la tienda.</p>
        } @else {
          <p class="intro">Este será el mazo con el que empieces tu viaje. Mira cada uno con calma: es gratis, pero solo puedes elegir uno.</p>
        }
        <div class="covers">
          @for (edition of options(); track edition.editionId) {
            <button type="button" class="option" (click)="viewing.set(edition.editionId)">
              <img [src]="edition.editionImage" alt="" />
              <span class="option-text">
                <span class="option-name">{{ edition.editionName ?? edition.editionId }}</span>
                <span class="option-tagline">{{ style(edition)?.tagline }}</span>
              </span>
            </button>
          } @empty {
            <eras-spinner />
          }
        </div>
      }
      <ng-container modal-footer>
        @if (current(); as edition) {
          <button erasButton variant="secondary" type="button" [disabled]="!!progression.claiming()" (click)="viewing.set(null)">
            <eras-icon name="chevron-left" /> Ver los otros
          </button>
          @if (!replay) {
            <button erasButton type="button" [loading]="!!progression.claiming()" (click)="choose(edition)">Elegir este mazo</button>
          }
        }
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .intro { margin: 0 0 var(--space-3); color: var(--color-text-muted); }
    .covers { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(11rem, 40vw), 1fr)); gap: var(--space-3); }
    .option {
      position: relative;
      display: block;
      overflow: hidden;
      padding: 0;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
      color: #fff;
      text-align: start;
      cursor: pointer;
      aspect-ratio: 3 / 4;
      transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
    }
    .option:hover, .option:focus-visible {
      transform: translateY(-4px);
      border-color: var(--color-hub-accent, var(--color-primary));
      box-shadow: 0 0.75rem 1.5rem color-mix(in srgb, var(--color-hub-accent, var(--color-primary)) 30%, transparent);
    }
    .option img { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; object-fit: cover; }
    .option-text {
      position: absolute;
      inset: auto 0 0;
      display: grid;
      gap: var(--space-1);
      padding: var(--space-6) var(--space-3) var(--space-3);
      background: linear-gradient(transparent, rgb(0 0 0 / 85%));
    }
    .option-name { font-family: var(--font-family-display); font-size: var(--font-size-md); letter-spacing: 0.03em; }
    .option-tagline { font-size: var(--font-size-xs); opacity: 0.85; }
    .detail { display: grid; grid-template-columns: minmax(0, 14rem) 1fr; gap: var(--space-4); align-items: start; }
    @media (max-width: 40rem) { .detail { grid-template-columns: 1fr; } .cover { max-inline-size: 12rem; } }
    .cover { inline-size: 100%; border-radius: var(--radius-md); aspect-ratio: 3 / 4; object-fit: cover; }
    .about p { margin: 0 0 var(--space-2); line-height: 1.55; }
    .color { color: var(--color-text-muted); font-size: var(--font-size-xs); letter-spacing: 0.05em; text-transform: uppercase; }
    .tagline { font-family: var(--font-family-display); font-size: var(--font-size-lg); }
    .lore { color: var(--color-text-muted); font-style: italic; }
    .tags { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .tag {
      padding: 0 var(--space-2);
      border: var(--border-width) solid var(--color-hub-accent, var(--color-primary));
      border-radius: var(--radius-pill);
      font-size: var(--font-size-xs);
    }
    .list-title { margin: var(--space-4) 0 var(--space-2); font-size: var(--font-size-md); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StructurePickerDialogComponent {
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  /** Seen again from "Progreso": every structure deck (owned ones too), only to look at. */
  protected readonly replay = inject<{ replay?: boolean } | null>(DIALOG_DATA, { optional: true })?.replay ?? false;
  protected readonly progression = inject(ProgressionStore);
  private readonly wallet = inject(WalletStore);
  private readonly editions = inject(EditionsStore);
  private readonly decks = inject(DecksStore);
  private readonly catalog = inject(CardsStore);
  private readonly modal = inject(ModalService);

  /** The structure deck being looked at, or null for the covers. */
  protected readonly viewing = signal<string | null>(null);
  protected readonly options = computed(() =>
    this.editions
      .editions()
      .filter((e) => isStructure(e.editionId) && (this.replay || !this.wallet.structures().has(e.editionId)))
      .sort((a, b) => a.editionId.localeCompare(b.editionId)),
  );
  protected readonly current = computed(() => this.options().find((e) => e.editionId === this.viewing()) ?? null);
  protected readonly subtitle = computed(() => (this.current() || this.replay ? null : 'Un regalo para empezar'));
  protected readonly list = computed(() => {
    const edition = this.current();
    const deck = edition ? structureDeck(this.decks.publicDecks(), edition.editionId) : null;
    return deck ? structureList(deck.cards, this.catalog.cards()) : [];
  });
  protected readonly total = computed(() => this.list().reduce((sum, e) => sum + e.copies, 0));

  protected readonly style = (edition: Edition) => structureStyle(edition.editionId);
  protected readonly lore = structureLore;
  protected readonly imageUrl = cardImageUrl;

  constructor() {
    void this.editions.load();
    void this.decks.loadPublic();
    void this.catalog.load();
  }

  protected openCard(card: CatalogCard): void {
    const cards = this.list().map((e) => e.card);
    const data: CardDetailDialogData = { cards, index: cards.indexOf(card) };
    this.modal.open(CardDetailDialogComponent, { data });
  }

  protected async choose(edition: Edition): Promise<void> {
    const name = edition.editionName ?? edition.editionId;
    const sure = await this.modal.confirm({
      title: `¿Empezar con ${name}?`,
      message: 'Es tu structure deck gratis: solo puedes elegir uno. Los demás podrás comprarlos en la tienda.',
      confirmLabel: 'Elegir',
    });
    if (sure && (await this.progression.claimStep(STRUCTURE_STEP, edition.editionId))) this.ref.close(edition.editionId);
  }
}
