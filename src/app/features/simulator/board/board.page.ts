import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { CdkMenuTrigger } from '@angular/cdk/menu';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { Router } from '@angular/router';
import { EditModeService } from '@core/auth/edit-mode.service';
import { CardsStore } from '@data/cards/cards.store';
import { sharedIndexForValue, sharedValueForIndex, isMatchActive } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { ChainListComponent } from './chain-list.component';
import { SharedBarComponent } from '@ui/domain/game-counters/shared-bar.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { IconButtonComponent } from '@ui/primitives/icon-button/icon-button.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { BoardDialogs } from './board-dialogs';
import { BoardEffects } from './board-effects';
import { BoardDrag } from './board-drag';
import { PlayerHalfComponent } from './player-half.component';
import { StatusPanelsComponent } from './status-panels.component';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { CardFlightsComponent } from './card-flights.component';
import { BoardAnimations } from './board-animations';
import { BoardChoreography } from './board-choreography';
import { BoardPreferences } from './board-preferences';
import { BoardScreen } from './board-screen';
import { seeThroughPress } from './board-see-through';
import { timingVars } from './timing';
import { DamageRevealComponent } from './damage-reveal.component';
import { ChainLinkRevealComponent } from './chain-link-reveal.component';
import { BoardFxComponent } from './board-fx.component';
import { MatchBannerComponent } from './match-banner.component';
import { PromptSpotlightComponent } from './prompt-spotlight.component';
import { PreRoomComponent } from './pre-room.component';
import { SidebarItemComponent } from './sidebar-item.component';
import { touchContextMenu } from './board-touch';
import { PhaseBarComponent } from './phase-bar.component';
import { PhasePopupComponent } from './phase-popup.component';
import { ReplayControlsComponent } from './replay-controls.component';
import { TestRoomControlsComponent } from './test-room-controls.component';

/** Game table: opponent on top (mirrored), you below, turn controls, shared gem bar and live notices. */
@Component({
  selector: 'eras-board-page',
  imports: [
    NgTemplateOutlet,
    CardFlightsComponent,
    DamageRevealComponent,
    ChainLinkRevealComponent,
    BoardFxComponent,
    MatchBannerComponent,
    PromptSpotlightComponent,
    PreRoomComponent,
    ChainListComponent,
    PlayerHalfComponent,
    StatusPanelsComponent,
    SharedBarComponent,
    StackComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    SpinnerComponent,
    IconComponent,
    SidebarItemComponent,
    PhaseBarComponent,
    PhasePopupComponent,
    ReplayControlsComponent,
    TestRoomControlsComponent,
    CdkMenuTrigger,
    IconButtonComponent,
    MenuComponent,
    MenuItemDirective,
  ],
  providers: [BoardDrag, BoardDialogs, BoardEffects, BoardAnimations, BoardChoreography, BoardScreen],
  templateUrl: './board.page.html',
  // The phone layouts (upright: turn it; landscape: compact) and the arcane table's style apart, within the size
  // budget of a stylesheet
  styleUrls: ['./board.page.scss', './board.page.phone.scss', './board.page.arcane.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A click elsewhere or Esc hides the selected card's actions (cards stop their own clicks)
  host: {
    '(document:keydown.escape)': 'game.pendingTargetSource.set(null); game.selectedId.set(null)',
    '(click)': 'game.selectedId.set(null)',
    '[class.fullscreen]': 'screen.fullView()',
    '[class.in-game]': 'inGame()',
    '[class.arcane]': 'inGame() && prefs.arcane()',
  },
})
export class BoardPage {
  /** Route param `:roomId`. */
  readonly roomId = input.required<string>();

  protected readonly game = inject(GameStore);
  protected readonly animations = inject(BoardAnimations);
  /** The table's preferences (remembered on the device) and the options sidebar's state. */
  protected readonly prefs = inject(BoardPreferences);
  /** Full screen, installed, landscape lock. */
  protected readonly screen = inject(BoardScreen);
  /** The animations' timings, as custom properties for the styles. */
  protected readonly timing = timingVars();
  private readonly drag = inject(BoardDrag);
  private readonly sheet = inject(SheetState);
  /** A choice is lowered to look at the table: nothing can be done meanwhile. */
  protected readonly lookOnly = this.sheet.lowered;
  /** Held to look at the table through the choice and the chain (both turn almost transparent). */
  protected readonly seeThrough = this.sheet.seeThrough;
  /** There is something over the table to look through: a sheet from the bottom (a choice…) or a chain. */
  /** The chain's list, opened from its button over the table. */
  protected readonly chainOpen = signal(false);
  protected readonly canSeeThrough = computed(() => this.sheet.open() > 0 || !!this.game.state()?.chain?.length);
  private readonly document = inject(DOCUMENT);
  protected readonly dialogs = inject(BoardDialogs);
  private readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  /** The site's edit mode banner already says it: no badge of its own then. */
  protected readonly editMode = inject(EditModeService);
  /** A replay's controls (in the sidebar), stopped when leaving it. */
  private readonly replayControls = viewChild(ReplayControlsComponent);

  protected readonly inProgress = computed(() => this.game.status() === 'IN_PROGRESS');
  /** A game in course, from the starters' choice to its end (online, only surrendering leaves it). */
  protected readonly playing = computed(() => isMatchActive(this.game.status()));
  /**
   * The game menu ends in Rendirse while a game is in course (online, Modo solo, ranked); the Sala de pruebas, a
   * replay or a game already over end in Salir.
   */
  protected readonly canSurrender = computed(() => this.playing() && !this.game.editorRoom() && !this.game.replayRoom());
  /** The game menu opens under its round button (top left of the table). */
  protected readonly gameMenuPosition: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
    { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 8 },
  ];
  /** Inside a game (after the pre-room): the options sidebar and the hidden navigation bar apply. */
  protected readonly inGame = computed(() => !!this.game.status() && this.game.status() !== 'WAITING');
  protected readonly sharedIndex = computed(() => sharedIndexForValue(this.game.state()?.sharedCounter ?? 0, this.game.isFirstPlayer()));
  protected readonly opponentLeft = computed(() => this.game.opponentState()?.connected === false);
  /** The owner of the room is the rival (if they stay away, the room passes to me). */
  protected readonly rivalOwns = computed(() => !!this.game.state()?.hostId && this.game.state()?.hostId === this.game.opponentState()?.userId);
  protected readonly dismissedLeft = signal(false);
  /** Sala de pruebas and replays: the other side, to look at the table from it. */
  protected readonly otherSide = computed(() => this.game.sides().find((p) => p.userId !== this.game.myState()?.userId) ?? null);
  private leaving = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // The page glows from the side of whoever has the priority
    effect(() => {
      const acting = this.game.actingId();
      const me = this.game.myState()?.userId;
      this.document.body.classList.toggle('eras-acting-me', !!acting && acting === me);
      this.document.body.classList.toggle('eras-acting-rival', !!acting && acting !== me);
    });
    // In a game: a phone held upright hides the choices too (they are in the top layer), behind "Gira el teléfono"
    effect(() => this.document.body.classList.toggle('eras-in-game', this.inGame()));
    // "Estilo de la mesa: arcano": the whole room (menus, dialogs and sheets too) in stone and gold while a game is on
    effect(() => this.document.body.classList.toggle('eras-arcane', this.inGame() && this.prefs.arcane()));
    // A chain is shown above the choices (they leave it room)
    // The chain's list open (from its button): the choices leave it room at the top
    effect(() => this.document.body.classList.toggle('eras-chain-open', this.chainOpen()));
    // Only with a sheet at the bottom do the alerts and the chain have to keep above it
    effect(() => this.document.body.classList.toggle('eras-sheet-open', this.sheet.open() > 0));
    destroyRef.onDestroy(() => this.document.body.classList.remove('eras-in-game', 'eras-arcane', 'eras-acting-me', 'eras-acting-rival', 'eras-chain-open', 'eras-sheet-open'));
    // While something plays, the next updates wait: each one is seen after the animation before it
    effect(() => this.game.holdUpdates.set(!this.animations.idle()));
    destroyRef.onDestroy(() => this.game.holdUpdates.set(false));
    // One animation at a time: what an update does plays on the table as it is, before the update is shown
    const choreography = inject(BoardChoreography);
    this.game.setPrelude((now, next) => choreography.prelude(now, next));
    destroyRef.onDestroy(() => this.game.setPrelude(null));
    // Card details in dialogs come from the catalog
    void this.cards.load();

    // Opening the board URL directly (reload, shared link) goes through the lobby, which joins the room
    effect(() => {
      const room = this.roomId();
      untracked(() => {
        if (this.game.roomId() !== room || !this.game.connected()) void this.router.navigate(['/simulator', room], { replaceUrl: true });
      });
    });

    // Taken out of the room (or it closed): back to the lobby, which says why
    effect(() => {
      if (!this.game.removed()) return;
      untracked(() => {
        this.leaving = true;
        void this.router.navigateByUrl(this.backTo(), { replaceUrl: true });
      });
    });

    effect(() => {
      if (!this.opponentLeft()) this.dismissedLeft.set(false);
    });

    // Rules-engine choices: one blocking dialog per prompt; it closes when the engine moves on
    let open: { id: string; close: () => void } | null = null;
    effect(() => {
      const prompt = this.game.myPrompt();
      // The choice waits until the animations on the table are over (a card flying, direct damage)
      const idle = this.animations.idle();
      untracked(() => {
        if (open && open.id !== prompt?.id) {
          open.close();
          open = null;
        }
        if (prompt && !open && idle) {
          // A short wait lets the animations of this very update start first
          setTimeout(() => {
            if (open || !this.animations.idle() || this.game.myPrompt()?.id !== prompt.id) return;
            const ref = this.dialogs.effectPrompt({ prompt });
            open = { id: prompt.id, close: () => ref.close() };
          }, 80);
        }
      });
    });
    destroyRef.onDestroy(() => open?.close());

    const win = this.document.defaultView;
    if (win) {
      // A long press on the table (or on a choice's backdrop) looks through the panels while it is held
      destroyRef.onDestroy(
        seeThroughPress(win, {
          canSeeThrough: this.canSeeThrough,
          sheetOpen: () => this.sheet.open() > 0,
          lookOnly: this.lookOnly,
          seeThrough: this.seeThrough,
          dragEnded: () => this.drag.end(),
        }),
      );
      // Touch screens: a long press on a card or pile opens its menu (with a panel to look through, it looks instead)
      destroyRef.onDestroy(touchContextMenu(win, () => !this.canSeeThrough() && !this.lookOnly()));
    }
    // Nothing left to look through: back to normal
    effect(() => {
      if (!this.canSeeThrough()) untracked(() => this.seeThrough.set(false));
    });
    // A choice raised again (or opened): a card picked while looking at the table lets go (its "Ver" over the choice)
    effect(() => {
      this.sheet.open();
      if (!this.sheet.lowered()) untracked(() => this.game.selectedId.set(null));
    });
    // The chain's list folds again once the chain is over
    effect(() => {
      if (!this.game.state()?.chain?.length) untracked(() => this.chainOpen.set(false));
    });
  }

  /** What the engine is doing: the effect resolving, or the optional effect waiting to be activated. */
  protected readonly engineNotice = computed(() => {
    const effect = this.game.resolving();
    // The chain itself is listed by <eras-chain-list>; while it is being built nothing resolves yet
    if (effect?.resolutionId) return `Resolviendo Cadena ${effect.link}: ${effect.sourceName} · ${effect.label}`;
    const prompt = this.game.state()?.prompt;
    if (prompt) return prompt.title;
    const combat = this.game.state()?.combat;
    if (!combat) return null;
    const all = Object.values(this.game.state()?.players ?? {}).flatMap((p) => p.field);
    const name = (id: string | null) => all.find((c) => c.instanceId === id)?.cardName ?? 'una criatura';
    const steps = { ATTACK: 'ataque', BLOCK: 'bloqueo', CLASH: 'enfrentamiento', DAMAGE: 'daño directo', END: 'final' } as const;
    return `Combate (${steps[combat.step]}): ${name(combat.attackerId)} ataca a ${combat.targetId ? name(combat.targetId) : 'su rival'}`;
  });

  /** Waiting on the opponent's choice for an effect. */
  protected readonly opponentChoosing = computed(() => {
    const prompt = this.game.state()?.prompt;
    return !!prompt && !this.game.myPrompt();
  });

  protected selectShared(index: number): void {
    // Moving the gems by hand is an editor action
    if (this.lookOnly() || !this.game.editorMode()) return;
    this.game.setCounter(sharedValueForIndex(index, this.game.isFirstPlayer()));
  }

  protected async surrender(): Promise<void> {
    if (await this.modal.confirm({ title: 'Rendirse', message: '¿Seguro que quieres rendirte?', confirmLabel: 'Rendirse', danger: true })) this.game.surrender();
  }

  /** Out of the board: Modo solo and the Sala de pruebas go back to "Jugar" (where they started), an online room to the rooms. */
  protected async exit(): Promise<void> {
    await this.router.navigateByUrl(this.backTo());
  }

  /** Where leaving the board goes: a replay to the profile (its history), Modo solo and the Sala de pruebas to "Jugar". */
  private backTo(): string {
    return this.game.replayRoom() ? '/profile' : this.game.ownRoom() ? '/play' : '/simulator';
  }

  /** The owner takes the disconnected rival out of the room (the game ends; the pre-room waits for another). */
  protected kickRival(): void {
    const rival = this.game.opponentState();
    if (rival) this.game.kickPlayer(rival.userId);
  }

  /**
   * Route guard. Leaving an online game in course loses it (asked first): the seat is freed and the rival wins.
   * Leaving Modo solo or the Sala de pruebas closes its room. Leaving the pre-room or a finished game frees the seat. Leaving always
   * disconnects.
   */
  async confirmLeave(): Promise<boolean> {
    // A replay is only watched: leaving closes it
    if (this.game.replayRoom()) {
      this.replayControls()?.stop();
      this.game.leaveRoom();
      this.game.disconnect();
      return true;
    }
    const playing = isMatchActive(this.game.status());
    if (!this.leaving && playing && !this.game.ownRoom() && !this.game.removed()) {
      const ok = await this.modal.confirm({
        title: 'Abandonar la partida',
        message: 'Si sales ahora, pierdes la partida y tu rival gana.',
        confirmLabel: 'Abandonar',
        danger: true,
      });
      if (!ok) return false;
      if (this.game.myState()) this.game.leaveRoom();
      this.game.disconnect();
      return true;
    }
    if (!this.leaving && playing && this.game.ownRoom()) {
      const title = this.game.botRoom() ? 'Salir del modo solo' : 'Salir de la sala de pruebas';
      // A ranked game left before its end is lost (and counts for the rank)
      const message = this.game.rankedRoom() ? 'Pierdes la partida ranked y cuenta para tu rango.' : 'La partida se cierra.';
      const ok = await this.modal.confirm({ title, message, confirmLabel: 'Salir', danger: this.game.rankedRoom() });
      if (!ok) return false;
    }
    if ((!playing || this.game.ownRoom()) && !this.game.removed() && this.game.myState()) this.game.leaveRoom();
    // Going back to the lobby of the same room keeps the connection (it reconnects there)
    this.game.disconnect();
    return true;
  }
}
