import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { BoardPreferences } from './board-preferences';
import { SidebarItemComponent } from './sidebar-item.component';
import { sidebarTimeline } from './sidebar-timeline';

/**
 * The sidebar's controls of the Sala de pruebas: the side played, the bots (and their pause), and the time line —
 * back and forth through the moves ("al presente" brings the last one back). The bots' edge and pace are in the
 * game's preferences (Bots).
 */
@Component({
  selector: 'eras-test-room-controls',
  imports: [SidebarItemComponent],
  template: `
    <button type="button" erasSidebarItem icon="swap" [on]="game.followActive()" (click)="game.followActive.set(!game.followActive())">
      Cambiar de lado según quién actúa
    </button>
    <!-- On, the bot takes the rival's decisions whenever it is its turn to act (at the level chosen before the game) -->
    <button type="button" erasSidebarItem icon="bot" [on]="!!game.state()?.editorBot" (click)="game.setEditorBot(!game.state()?.editorBot)">
      El bot juega el lado del rival
    </button>
    @if (game.simulatorAdmin() || game.state()?.editorSelfBot) {
      <!-- Your side's bot: the same bot, in contrast -->
      <button type="button" erasSidebarItem icon="bot" class="contrast" [on]="!!game.state()?.editorSelfBot" (click)="game.setEditorSelfBot(!game.state()?.editorSelfBot)">
        Un bot juega tu lado
      </button>
    }
    <!-- The bots wait while paused (going back in time pauses them too) -->
    @if (game.state()?.editorBot || game.state()?.editorSelfBot) {
      <button type="button" erasSidebarItem [icon]="game.state()?.paused ? 'play' : 'pause'" [on]="!!game.state()?.paused" (click)="game.setPaused(!game.state()?.paused)">
        {{ game.state()?.paused ? 'Reanudar los bots' : 'Pausar los bots' }}
      </button>
    }
    <!-- The time line: back and forth through the moves; a move from the past forgets the future -->
    @if (timeline.label(); as step) {
      @if (prefs.sidebarOpen()) {
        <div erasSidebarItem icon="history" class="pace-item">
          Jugadas{{ timeline.inThePast() ? ' (en el pasado)' : '' }}
          <span class="pace">
            <button type="button" aria-label="Jugada anterior" (click)="game.timeStep({ by: -1 })">◀</button>
            <b>{{ step }}</b>
            <button type="button" aria-label="Jugada siguiente" [disabled]="!timeline.inThePast()" (click)="game.timeStep({ by: 1 })">▶</button>
            <button type="button" class="auto" [disabled]="!timeline.inThePast()" (click)="timeline.toPresent()">al presente</button>
          </span>
        </div>
      } @else {
        <button type="button" erasSidebarItem icon="history" [on]="timeline.inThePast()" (click)="prefs.sidebarExpanded.set(true)">Jugadas: {{ step }}</button>
      }
    }
  `,
  styleUrl: './sidebar-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestRoomControlsComponent {
  protected readonly game = inject(GameStore);
  protected readonly prefs = inject(BoardPreferences);
  protected readonly timeline = sidebarTimeline(this.game);
}
