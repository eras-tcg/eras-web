import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { EditModeService } from '@core/auth/edit-mode.service';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { EditionsStore } from '@data/editions/editions.store';
import { HomeStore } from '@data/home/home.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ChoiceDialogComponent, ChoiceDialogData } from '@ui/surfaces/choice-dialog/choice-dialog.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { HubCarouselComponent } from './hub-carousel.component';
import { HubMenuComponent, HubMenuItem } from './hub-menu.component';
import { hubSlides, nextStep } from './hub-rules';
import { HubScreenComponent } from './hub-screen.component';
import { NEWS } from './news';

/** The site's main menu, in one screen like a game's. */
const MAIN_MENU: HubMenuItem[] = [
  { id: 'play', label: 'Jugar', icon: 'gamepad', route: '/play' },
  { id: 'decks', label: 'Mazos', icon: 'stack', route: '/my-decks' },
  { id: 'editions', label: 'Ediciones', icon: 'layers', route: '/editions' },
  { id: 'cards', label: 'Cartas', icon: 'cards', route: '/cards' },
  { id: 'social', label: 'Social', icon: 'users', route: '/social' },
];

/**
 * Home hub: the main menu, a carousel (featured edition, featured decks, news) and a suggested next step, over a
 * random edition artwork. The featured content stays editable in edit mode (manage_home).
 */
@Component({
  selector: 'eras-home-page',
  imports: [RouterLink, AlertComponent, ButtonComponent, IconComponent, HubCarouselComponent, HubMenuComponent, HubScreenComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly home = inject(HomeStore);
  protected readonly editMode = inject(EditModeService);
  private readonly auth = inject(AuthService);
  private readonly editions = inject(EditionsStore);
  private readonly decks = inject(DecksStore);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly menu = MAIN_MENU;
  protected readonly myDecks = signal<number | null>(null);
  protected readonly playerMeta = computed(() => {
    const count = this.myDecks();
    return count === null ? null : `${count} ${count === 1 ? 'mazo' : 'mazos'}`;
  });
  protected readonly step = computed(() => nextStep(this.myDecks(), Math.floor(Date.now() / 86_400_000)));
  protected readonly slides = computed(() => hubSlides(this.home.content().edition, this.home.content().decks, NEWS));
  protected readonly saveError = signal<string | null>(null);

  constructor() {
    void this.home.load();
    const user = this.auth.user();
    if (user) void this.loadMyDecks(user.id);

    const unregister = this.editMode.registerDirty(() => this.home.editing());
    inject(DestroyRef).onDestroy(unregister);
    // Turning edit mode off (already confirmed by the switch) drops the draft
    effect(() => {
      if (!this.editMode.active() && untracked(() => this.home.editing())) this.home.cancelEdit();
    });
  }

  protected openCards(editionId: string): void {
    void this.router.navigate(['/cards'], { queryParams: { edition: editionId } });
  }

  protected openDeck(deck: Deck): void {
    void this.router.navigate(['/deck', deck.id]);
  }

  private async loadMyDecks(userId: string): Promise<void> {
    await this.decks.loadMine(userId);
    // On a failed load there is no count (and no suggestion), rather than a wrong "0 decks"
    this.myDecks.set(this.decks.error() ? null : this.decks.myDecks().length);
  }

  // --- Featured content editing (manage_home) ---

  protected startEdit(): void {
    this.saveError.set(null);
    this.home.startEdit();
    // Options for the pickers; loaded only when someone edits
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
