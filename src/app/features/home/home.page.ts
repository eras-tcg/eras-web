import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EditDirective } from '@core/auth/edit.directive';
import { EditModeService } from '@core/auth/edit-mode.service';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { EditionsStore } from '@data/editions/editions.store';
import { HomeStore } from '@data/home/home.store';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { FeaturedEditionComponent } from '@ui/domain/featured-edition/featured-edition.component';
import { NewsCardComponent } from '@ui/domain/news-card/news-card.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { HomeLayoutComponent } from '@ui/layout/home-layout/home-layout.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ChoiceDialogComponent, ChoiceDialogData } from '@ui/surfaces/choice-dialog/choice-dialog.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { NEWS } from './news';

/** Landing page in one screen: featured edition, featured decks and news. Editable in edit mode (manage_home). */
@Component({
  selector: 'eras-home-page',
  imports: [
    EditDirective,
    HomeLayoutComponent,
    StackComponent,
    DeckCoverComponent,
    FeaturedEditionComponent,
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
  private readonly router = inject(Router);

  protected readonly news = NEWS;
  protected readonly saveError = signal<string | null>(null);

  constructor() {
    void this.home.load();
    const editMode = inject(EditModeService);
    const unregister = editMode.registerDirty(() => this.home.editing());
    inject(DestroyRef).onDestroy(unregister);
    // Turning edit mode off (already confirmed by the navbar) drops the draft
    effect(() => {
      if (!editMode.active() && untracked(() => this.home.editing())) this.home.cancelEdit();
    });
  }

  protected openCards(editionId: string): void {
    void this.router.navigate(['/cards'], { queryParams: { edition: editionId } });
  }

  protected openDeck(deck: Deck | null): void {
    if (deck) void this.router.navigate(['/deck', deck.id]);
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
