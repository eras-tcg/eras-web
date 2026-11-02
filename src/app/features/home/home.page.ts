import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { AvatarStore } from '@core/auth/avatar.store';
import { EditModeService } from '@core/auth/edit-mode.service';
import { AppToolsComponent } from '@core/layout/app-tools.component';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { Edition } from '@data/editions/edition.model';
import { EditionsStore } from '@data/editions/editions.store';
import { HomeStore } from '@data/home/home.store';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ChoiceDialogComponent, ChoiceDialogData } from '@ui/surfaces/choice-dialog/choice-dialog.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { HubActionsComponent } from './hub-actions.component';
import { HubCarouselComponent } from './hub-carousel.component';
import { hubSlides, nextStep, pickBackground } from './hub-rules';
import { NEWS } from './news';

const BACKGROUND_KEY = 'eras-hub-background';

/**
 * Home hub, the site's main menu in one screen like a game's: random edition artwork behind, the player, a
 * carousel (featured edition, featured decks, news), a suggested next step and the big action buttons.
 * The featured content stays editable in edit mode (manage_home).
 */
@Component({
  selector: 'eras-home-page',
  imports: [RouterLink, AppToolsComponent, AvatarComponent, AlertComponent, ButtonComponent, IconComponent, HubActionsComponent, HubCarouselComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly home = inject(HomeStore);
  protected readonly auth = inject(AuthService);
  protected readonly avatar = inject(AvatarStore);
  protected readonly editMode = inject(EditModeService);
  private readonly editions = inject(EditionsStore);
  private readonly decks = inject(DecksStore);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly background = signal<Edition | null>(null);
  protected readonly myDecks = signal<number | null>(null);
  protected readonly step = computed(() => nextStep(this.myDecks(), Math.floor(Date.now() / 86_400_000)));

  protected readonly slides = computed(() => hubSlides(this.home.content().edition, this.home.content().decks, NEWS));

  protected readonly saveError = signal<string | null>(null);

  constructor() {
    void this.home.load();
    void this.loadBackground();
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

  private async loadBackground(): Promise<void> {
    await this.editions.load();
    const chosen = pickBackground(this.editions.editions(), readSession(BACKGROUND_KEY));
    this.background.set(chosen);
    if (chosen) writeSession(BACKGROUND_KEY, chosen.editionId);
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

// Storage can be unavailable (private mode): the hub then just may repeat a background
function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignored, see readSession
  }
}
