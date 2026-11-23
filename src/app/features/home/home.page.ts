import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { EditModeService } from '@core/auth/edit-mode.service';
import { ServerAccess } from '@core/server/server-access';
import { ProgressionStore } from '@core/missions/progression.store';
import { VersionTagComponent } from '@core/version/version-tag.component';
import { DecksStore } from '@data/decks/decks.store';
import { EditionsStore } from '@data/editions/editions.store';
import { HomeStore } from '@data/home/home.store';
import { HomeNews } from '@data/home/home.model';
import { newsDateLabel } from '@data/home/default-news';
import { CardsStore } from '@data/cards/cards.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ChoiceDialogComponent, ChoiceDialogData } from '@ui/surfaces/choice-dialog/choice-dialog.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { HubCarouselComponent } from './hub-carousel.component';
import { HubMenuComponent, HubMenuItem } from './hub-menu.component';
import { HubSlide, NextStep, hubSlides, nextStep, welcomeNextStep } from './hub-rules';
import { HubScreenComponent } from './hub-screen.component';
import { MissionGuideFlow } from './mission-guide-flow';
import { NewsDialogComponent } from './news-dialog.component';
import { editNews } from './news-edit-dialog.component';
import { WelcomeFlow } from './welcome-flow';

/** The site's main menu, in one screen like a game's. */
const MAIN_MENU: HubMenuItem[] = [
  { id: 'play', label: 'Jugar', icon: 'gamepad', route: '/play' },
  { id: 'decks', label: 'Mazos', icon: 'stack', route: '/my-decks' },
  { id: 'editions', label: 'Tienda', icon: 'box', route: '/editions' },
  { id: 'cards', label: 'Cartas', icon: 'cards', route: '/cards' },
  { id: 'social', label: 'Social', icon: 'users', route: '/social' },
];

/**
 * Home hub: the main menu, a carousel (featured edition, news: each a showcase with its cards whole) and a suggested
 * next step, over a random edition artwork. In edit mode (manage_home) the carousel gives way to its editor: the
 * featured edition and the news as a list (new, edit, order, delete), saved together.
 */
@Component({
  selector: 'eras-home-page',
  imports: [NgTemplateOutlet, RouterLink, AlertComponent, ButtonComponent, IconComponent, HubCarouselComponent, HubMenuComponent, HubScreenComponent, VersionTagComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly home = inject(HomeStore);
  protected readonly editMode = inject(EditModeService);
  private readonly auth = inject(AuthService);
  private readonly editions = inject(EditionsStore);
  private readonly cards = inject(CardsStore);
  private readonly decks = inject(DecksStore);
  private readonly progression = inject(ProgressionStore);
  private readonly welcome = inject(WelcomeFlow);
  private readonly guide = inject(MissionGuideFlow);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly menu = MAIN_MENU;
  protected readonly myDecks = signal<number | null>(null);
  /** The "Bienvenida" step to do now while the chain is not complete; afterwards, a suggestion. */
  protected readonly step = computed(
    () => welcomeNextStep(this.progression.board()?.welcome ?? null) ?? nextStep(this.myDecks(), Math.floor(Date.now() / 86_400_000)),
  );
  /** "Progreso" missions still pending (the welcome chain, or a step or milestone to claim): the next step glows. */
  protected readonly progressPending = computed(
    () => welcomeNextStep(this.progression.board()?.welcome ?? null) !== null || this.progression.waiting() > 0,
  );
  protected readonly slides = computed(() =>
    hubSlides(this.home.content().edition, this.home.news(), this.cards.cards()),
  );
  protected readonly saveError = signal<string | null>(null);

  constructor() {
    // A new player is greeted (the first "Bienvenida" step), once per visit
    effect(() => {
      const board = this.progression.board();
      untracked(() => this.welcome.greetIfNew(board));
    });
    // The installed app before connecting shows what the device keeps (ServerAccess); connecting reads it for real
    const access = inject(ServerAccess);
    effect(() => {
      access.allowed();
      untracked(() => {
        void this.home.load();
        void this.editions.load(); // the hub's background artwork
        void this.cards.load(); // the cards of the carousel
        const user = this.auth.user();
        if (user) void this.loadMyDecks(user.id);
      });
    });

    const unregister = this.editMode.registerDirty(() => this.home.editing());
    inject(DestroyRef).onDestroy(unregister);
    // Turning edit mode off (already confirmed by the switch) drops the draft
    effect(() => {
      if (!this.editMode.active() && untracked(() => this.home.editing())) this.home.cancelEdit();
    });
  }

  /** A slide's button: a page of the site. */
  protected openSlide(url: string): void {
    void this.router.navigateByUrl(url);
  }

  /** A slide clicked: the featured edition goes to its page in Ediciones, a news item opens in full (its button, if any, leads on). */
  protected async selectSlide(slide: HubSlide): Promise<void> {
    if (slide.link) {
      this.openSlide(slide.link);
      return;
    }
    const url = await firstValueFrom(this.modal.open<string, HubSlide>(NewsDialogComponent, { data: slide }).closed);
    if (url) this.openSlide(url);
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

  // --- The carousel's news (edit mode) ---

  protected readonly dateLabel = newsDateLabel;

  protected async newNews(): Promise<void> {
    const item = await editNews(this.modal, { news: null, cards: this.cards.cards() });
    if (item) this.home.setNews([item, ...this.home.news()]);
  }

  protected async editNewsAt(index: number): Promise<void> {
    const list = this.home.news();
    const item = await editNews(this.modal, { news: list[index], cards: this.cards.cards() });
    if (item) this.home.setNews(list.map((n, i) => (i === index ? item : n)));
  }

  protected moveNews(index: number, delta: number): void {
    const list = [...this.home.news()];
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    this.home.setNews(list);
  }

  protected async deleteNews(index: number): Promise<void> {
    const item = this.home.news()[index];
    const ok = await this.modal.confirm({ title: 'Borrar noticia', message: `«${item.title}» deja la portada al guardar.`, confirmLabel: 'Borrar' });
    if (ok) this.home.setNews(this.home.news().filter((_, i) => i !== index));
  }

  /** The cards' names of a news item, for its row. */
  protected cardNames(item: HomeNews): string {
    const byId = new Map(this.cards.cards().map((c) => [c.id, c.meta?.cardName ?? c.name ?? '']));
    return item.cardIds.map((id) => byId.get(id)).filter(Boolean).join(', ');
  }

  protected async save(): Promise<void> {
    this.saveError.set(null);
    try {
      await this.home.save();
    } catch (e) {
      this.saveError.set(e instanceof Error ? e.message : 'No se pudo guardar la portada');
    }
  }

  /** A "Bienvenida" step told as a dialog (the greeting, the structure deck picker) opens it instead of the route. */
  protected openStep(step: NextStep): void {
    if (step.guide) void this.guide.open(step.guide, step.route);
    else void (step.flow === 'welcome' ? this.welcome.start() : this.welcome.pickStructure());
  }
}
