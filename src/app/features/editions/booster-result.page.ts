import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { RARITY_NAMES, RarityGroup, cardsByRarity, groupOpening, openBox, openPack } from '@data/editions/booster-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { Rarity, RarityBadgeComponent } from '@ui/domain/rarity-badge/rarity-badge.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../cards/card-detail-dialog/card-detail-dialog.component';

/**
 * Result of a simulated opening, from the Editions "Simular apertura" dialog:
 * /booster-result?edition=E1&mode=pack|box&packType=Normal[&random=1]. Same URL as the legacy page.
 */
@Component({
  selector: 'eras-booster-result-page',
  imports: [
    PageComponent,
    GridComponent,
    SectionHeaderComponent,
    CardThumbComponent,
    RarityBadgeComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  template: `
    <eras-page [title]="title()" [subtitle]="subtitle()" width="wide">
      <ng-container ngProjectAs="[page-actions]">
        <button erasButton variant="ghost" type="button" (click)="back()"><eras-icon name="chevron-left" /> Volver</button>
        <button erasButton type="button" [disabled]="!ready()" (click)="reroll()"><eras-icon name="box" /> Volver a abrir</button>
      </ng-container>

      @if (cards.error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      @if (!ready()) {
        <eras-empty-state title="Simulando…"><eras-spinner /></eras-empty-state>
      } @else if (groups().length === 0) {
        <eras-empty-state
          title="No se pudo simular"
          description="Verifica que la edición tenga cartas con rareza y una configuración de sobre (o de caja)."
        />
      } @else {
        <p>{{ total() }} {{ total() === 1 ? 'carta obtenida' : 'cartas obtenidas' }}</p>
        @for (group of groups(); track group.rarity) {
          <eras-section-header [title]="rarityName(group.rarity) + ' (' + group.count + ')'">
            <eras-rarity-badge [rarity]="asRarity(group.rarity)" />
          </eras-section-header>
          <eras-grid minColumn="9rem" [gap]="3">
            @for (opened of group.cards; track opened.card.id) {
              <eras-card-thumb
                [name]="opened.card.name ?? ''"
                [imageUrl]="imageUrl(opened.card)"
                [count]="opened.count"
                (selected)="openCard(opened.card)"
              />
            }
          </eras-grid>
        }
      }
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoosterResultPage {
  readonly edition = input<string>('');
  readonly mode = input<string>('pack');
  readonly packType = input<string>('');
  readonly random = input<string>();

  protected readonly cards = inject(CardsStore);
  private readonly editions = inject(EditionsStore);
  private readonly modal = inject(ModalService);
  private readonly location = inject(Location);

  /** Bumped by "Volver a abrir" to draw again. */
  private readonly attempt = signal(0);
  protected readonly ready = computed(() => this.cards.cards().length > 0 && this.editions.editions().length > 0);
  private readonly isBox = computed(() => this.mode() === 'box');
  private readonly editionData = computed(() => this.editions.editions().find((e) => e.editionId === this.edition()) ?? null);

  protected readonly groups = signal<RarityGroup[]>([]);
  protected readonly total = computed(() => this.groups().reduce((sum, g) => sum + g.count, 0));
  protected readonly title = computed(() => (this.isBox() ? 'Apertura de caja' : this.random() === '1' ? 'Sobre al azar de una caja' : 'Apertura de sobre'));
  protected readonly subtitle = computed(() => {
    const e = this.editionData();
    const name = e?.editionName ? `${this.edition()} — ${e.editionName}` : this.edition();
    return !this.isBox() && this.packType() ? `${name} · ${this.packType()}` : name;
  });
  protected readonly imageUrl = cardImageUrl;
  protected readonly rarityName = (r: string) => RARITY_NAMES[r] ?? r;
  protected readonly asRarity = (r: string) => r as Rarity;

  constructor() {
    void this.cards.load();
    void this.editions.load();
    effect(() => {
      this.attempt();
      if (!this.ready()) return;
      const edition = this.editionData();
      const box = this.isBox();
      const packName = this.packType();
      untracked(() => {
        const packs = edition?.packTypes ?? [];
        if (!edition || !packs.length) {
          this.groups.set([]);
          return;
        }
        const pool = cardsByRarity(this.cards.cards(), edition.editionId);
        const pack = packs.find((p) => p.name === packName) ?? packs[0];
        this.groups.set(groupOpening(box ? openBox(edition, pool) : openPack(pack, pool)));
      });
    });
  }

  protected reroll(): void {
    this.attempt.update((n) => n + 1);
  }

  protected back(): void {
    this.location.back();
  }

  protected openCard(card: CatalogCard): void {
    const flat = this.groups().flatMap((g) => g.cards.map((c) => c.card));
    const data: CardDetailDialogData = { cards: flat, index: flat.indexOf(card) };
    this.modal.open(CardDetailDialogComponent, { data });
  }
}
