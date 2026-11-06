import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { BoardPreferences } from './board-preferences';
import { SidebarItemComponent } from './sidebar-item.component';
import { sidebarTimeline } from './sidebar-timeline';

/** A replay played by itself: the pause between its moves. */
const REPLAY_STEP_MS = 1200;

/** The sidebar's controls of a replay: played by itself, or move by move (⏮ ◀ ▶ ⏭). */
@Component({
  selector: 'eras-replay-controls',
  imports: [SidebarItemComponent],
  template: `
    <button type="button" erasSidebarItem [icon]="autoplay() ? 'pause' : 'play'" [on]="autoplay()" (click)="toggleAutoplay()">
      {{ autoplay() ? 'Pausar la repetición' : 'Reproducir' }}
    </button>
    @if (timeline.label(); as step) {
      @if (prefs.sidebarOpen()) {
        <div erasSidebarItem icon="history" class="pace-item">
          Jugadas
          <span class="pace">
            <button type="button" aria-label="Al principio" (click)="stop(); game.timeStep({ to: 0 })">⏮</button>
            <button type="button" aria-label="Jugada anterior" (click)="stop(); game.timeStep({ by: -1 })">◀</button>
            <b>{{ step }}</b>
            <button type="button" aria-label="Jugada siguiente" [disabled]="!timeline.inThePast()" (click)="stop(); game.timeStep({ by: 1 })">▶</button>
            <button type="button" aria-label="Al final" [disabled]="!timeline.inThePast()" (click)="stop(); timeline.toPresent()">⏭</button>
          </span>
        </div>
      } @else {
        <button type="button" erasSidebarItem icon="history" (click)="prefs.sidebarExpanded.set(true)">Jugadas: {{ step }}</button>
      }
    }
  `,
  styleUrl: './sidebar-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplayControlsComponent {
  protected readonly game = inject(GameStore);
  protected readonly prefs = inject(BoardPreferences);
  protected readonly timeline = sidebarTimeline(this.game);

  /** Played by itself: a move every moment until its end. */
  protected readonly autoplay = signal(false);
  private autoplayTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected toggleAutoplay(): void {
    if (this.autoplay()) {
      this.stop();
      return;
    }
    const s = this.game.state();
    // From the start again when it was at the end
    if (s?.timelineSize && (s.timelineAt ?? 0) >= s.timelineSize - 1) this.game.timeStep({ to: 0 });
    this.autoplay.set(true);
    this.autoplayTimer = setInterval(() => {
      const now = this.game.state();
      if (!now?.timelineSize || (now.timelineAt ?? 0) >= now.timelineSize - 1) this.stop();
      else this.game.timeStep({ by: 1 });
    }, REPLAY_STEP_MS);
  }

  /** Stops playing by itself (a move by hand, or leaving the replay). */
  stop(): void {
    if (this.autoplayTimer) clearInterval(this.autoplayTimer);
    this.autoplayTimer = null;
    this.autoplay.set(false);
  }
}
