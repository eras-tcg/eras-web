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
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ChoiceDialogComponent, ChoiceDialogData } from '@ui/surfaces/choice-dialog/choice-dialog.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { HubCarouselComponent } from './hub-carousel.component';
import { HubMenuComponent, HubMenuItem } from './hub-menu.component';
import { NextStep, hubSlides, nextStep, welcomeNextStep } from './hub-rules';
import { HubScreenComponent } from './hub-screen.component';
import { MissionGuideFlow } from './mission-guide-flow';
import { NEWS } from './news';
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
 * Home hub: the main menu, a carousel (featured edition, news) and a suggested next step, over a
 * random edition artwork. The featured content stays editable in edit mode (manage_home).
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
    hubSlides(this.home.content().edition, NEWS, this.editions.editions()),
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
        void this.editions.load(); // artwork of the news
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

  protected openCards(editionId: string): void {
    void this.router.navigate(['/cards'], { queryParams: { edition: editionId } });
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
