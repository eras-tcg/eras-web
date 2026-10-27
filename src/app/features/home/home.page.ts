import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CanDirective } from '@core/auth/can.directive';
import { legacyUrl } from '@core/navigation/legacy-url';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { EditionsStore } from '@data/editions/editions.store';
import { HomeStore } from '@data/home/home.store';
import { DeckTileComponent } from '@ui/domain/deck-tile/deck-tile.component';
import { FeaturedEditionComponent } from '@ui/domain/featured-edition/featured-edition.component';
import { NewsCardComponent } from '@ui/domain/news-card/news-card.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { SplitComponent } from '@ui/layout/split/split.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ChoiceDialogComponent, ChoiceDialogData } from '@ui/surfaces/choice-dialog/choice-dialog.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { NEWS } from './news';

/** Landing page: featured edition, featured decks and news. With manage_home the content can be edited. */
@Component({
  selector: 'eras-home-page',
  imports: [
    CanDirective,
    PageComponent,
    SplitComponent,
    GridComponent,
    SectionHeaderComponent,
    FeaturedEditionComponent,
    DeckTileComponent,
    NewsCardComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './home.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly home = inject(HomeStore);
  private readonly editions = inject(EditionsStore);
  private readonly decks = inject(DecksStore);
  private readonly modal = inject(ModalService);

  protected readonly news = NEWS;
  protected readonly saveError = signal<string | null>(null);

  constructor() {
    void this.home.load();
  }

  protected openCards(editionId: string): void {
    // The cards page is not migrated yet
    window.location.assign(legacyUrl(`/cards?edition=${encodeURIComponent(editionId)}`));
  }

  protected openDeck(deck: Deck | null): void {
    if (deck) window.location.assign(legacyUrl(`/deck/${encodeURIComponent(deck.id)}`));
  }

  protected startEdit(): void {
    this.saveError.set(null);
    this.home.startEdit();
    // Options for the pickers; loaded only when someone edits
    void this.editions.load();
    void this.decks.loadPublic();
  }

  protected async pickEdition(): Promise<void> {
    await this.editions.load();
    const data: ChoiceDialogData = {
      title: 'Edición destacada',
      options: this.editions.editions().map((e) => ({ value: e.editionId, label: e.editionName ?? e.editionId, hint: e.editionId })),
    };
    const id = await firstValueFrom(this.modal.open<string | null>(ChoiceDialogComponent, { data }).closed);
    const edition = this.editions.editions().find((e) => e.editionId === id);
    if (edition) this.home.setEdition(edition);
  }

  protected async pickDeck(slot: number): Promise<void> {
    await this.decks.loadPublic();
    const data: ChoiceDialogData = {
      title: `Mazo destacado #${slot + 1}`,
      options: this.decks.publicDecks().map((d) => ({ value: d.id, label: d.deckName, hint: d.username })),
      clearLabel: 'Dejar vacío',
    };
    const id = await firstValueFrom(this.modal.open<string | null>(ChoiceDialogComponent, { data }).closed);
    if (id === undefined) return;
    this.home.setDeck(slot, id === null ? null : (this.decks.publicDecks().find((d) => d.id === id) ?? null));
  }

  protected async save(): Promise<void> {
    this.saveError.set(null);
    try {
      await this.home.save();
    } catch (e) {
      this.saveError.set(e instanceof Error ? e.message : 'No se pudo guardar la portada');
    }
  }
}
