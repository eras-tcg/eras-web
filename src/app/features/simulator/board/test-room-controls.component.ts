import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { BoardPreferences } from './board-preferences';
import { SidebarItemComponent } from './sidebar-item.component';
import { sidebarTimeline } from './sidebar-timeline';
import { BOT_EDGE_MAX, botEdgeText } from '@data/simulator/game-rules';

/**
 * The sidebar's controls of the Sala de pruebas: the side played, the bots (and their pause), and the time line —
 * back and forth through the moves ("al presente" brings the last one back).
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
    <!-- The rival's edge, as the hardest bot gets it in Modo solo past its strength: from none up to 8 -->
    @if (prefs.sidebarOpen()) {
      <div erasSidebarItem icon="trophy" class="pace-item" [title]="edgeText() || 'Sin ventaja'">
        Ventaja del bot (lado rival)
        <span class="pace">
          <button type="button" aria-label="Menos ventaja" [disabled]="edge() <= 0" (click)="game.setBotEdge(edge() - 1)">−</button>
          <b>{{ edge() ? 'nivel ' + edge() : 'ninguna' }}</b>
          <button type="button" aria-label="Más ventaja" [disabled]="edge() >= edgeMax" (click)="game.setBotEdge(edge() + 1)">+</button>
        </span>
        @if (edgeText(); as text) {
          <small class="edge-text">{{ text }}</small>
        }
      </div>
    } @else {
      <button type="button" erasSidebarItem icon="trophy" (click)="prefs.sidebarExpanded.set(true)">Ventaja del bot: {{ edge() ? 'nivel ' + edge() : 'ninguna' }}</button>
    }
    <!-- The pause before each bot move, to follow what happens: less or more, or each bot's own pace -->
    @if (prefs.sidebarOpen()) {
      <div erasSidebarItem icon="clock" class="pace-item">
        Pausa entre jugadas de los bots
        <span class="pace">
          <button type="button" aria-label="Menos pausa" (click)="pace(-250)">−</button>
          <b>{{ paceLabel() }}</b>
          <button type="button" aria-label="Más pausa" (click)="pace(250)">+</button>
          <button type="button" class="auto" [disabled]="(game.state()?.botDelayMs ?? null) === null" (click)="game.setBotDelay(null)">auto</button>
        </span>
      </div>
    } @else {
      <button type="button" erasSidebarItem icon="clock" (click)="prefs.sidebarExpanded.set(true)">Pausa entre jugadas de los bots: {{ paceLabel() }}</button>
    }
  `,
  styleUrl: './sidebar-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestRoomControlsComponent {
  protected readonly game = inject(GameStore);
  protected readonly prefs = inject(BoardPreferences);
  protected readonly timeline = sidebarTimeline(this.game);

  /** The pause before each bot move, shown in seconds ("auto": each bot's own, about 1 s). */
  protected readonly paceLabel = computed(() => {
    const ms = this.game.state()?.botDelayMs;
    return ms == null ? 'auto' : (ms / 1000).toLocaleString('es', { maximumFractionDigits: 2 }) + ' s';
  });

  /** The rival's edge (0: none) and what it does. */
  protected readonly edge = computed(() => this.game.state()?.botEdge ?? 0);
  protected readonly edgeText = computed(() => botEdgeText(this.edge()));
  protected readonly edgeMax = BOT_EDGE_MAX;

  protected pace(delta: number): void {
    const now = this.game.state()?.botDelayMs ?? 1000;
    this.game.setBotDelay(Math.max(0, Math.min(10000, now + delta)));
  }
}
