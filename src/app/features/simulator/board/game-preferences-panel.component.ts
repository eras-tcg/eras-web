import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input, linkedSignal } from '@angular/core';
import { BOT_EDGE_MAX, botEdgeText } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { ThemeService } from '@core/theme/theme.service';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';
import { BoardPreferences } from './board-preferences';
import { BoardScreen } from './board-screen';

type Section = 'interface' | 'table' | 'hand' | 'screen' | 'bots';

/**
 * The player's preferences in sections, one at a time: the site's look (from the profile), the table, the hand, the
 * screen and, in a game of the Sala de pruebas, its bots (their edge and pace). Kept on the device and with the account
 * (PreferenceSync), so they are the same in the game's dialog and in the profile.
 */
@Component({
  selector: 'eras-game-preferences-panel',
  imports: [IconComponent],
  template: `
    <div class="tabs" role="tablist" aria-label="Secciones">
      @for (t of sections(); track t.id) {
        <button type="button" role="tab" class="tab" [class.on]="section() === t.id" [attr.aria-selected]="section() === t.id" (click)="section.set(t.id)">
          <eras-icon [name]="t.icon" />{{ t.label }}
        </button>
      }
    </div>
    <div class="prefs" role="tabpanel">
      @switch (section()) {
        @case ('interface') {
          <!-- Each click: claro ↔ oscuro -->
          <button type="button" class="pref" (click)="theme.toggle()">
            <eras-icon [name]="theme.theme() === 'dark' ? 'moon' : 'sun'" />
            <span class="text"><strong>Tema</strong><small>Los colores de todo el sitio</small></span>
            <span class="state">{{ theme.theme() === 'dark' ? 'Oscuro' : 'Claro' }}</span>
          </button>
        }
        @case ('table') {
          <!-- Each click: limpio ↔ arcano -->
          <button type="button" class="pref" (click)="prefs.tableStyle.set((prefs.tableStyle() + 1) % 2)">
            <eras-icon name="sparkles" />
            <span class="text"><strong>Estilo de la mesa</strong></span>
            <span class="state">{{ prefs.tableStyleNames[prefs.tableStyle()] }}</span>
          </button>
          <!-- Each click: total → suave → nula -->
          <button type="button" class="pref" (click)="prefs.zoneLook.set((prefs.zoneLook() + 1) % 3)">
            <eras-icon name="eye" />
            <span class="text"><strong>Visibilidad de zonas</strong><small>Cuánto se marcan las zonas de la mesa</small></span>
            <span class="state">{{ prefs.zoneLookNames[prefs.zoneLook()] }}</span>
          </button>
          <label class="pref tilt">
            <eras-icon name="box" />
            <span class="text">
              <strong>Mesa en perspectiva</strong>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                aria-label="Inclinación de la mesa"
                [value]="prefs.tilt()"
                (input)="prefs.tilt.set($any($event.target).valueAsNumber)"
              />
            </span>
          </label>
          <button type="button" class="pref" role="switch" [attr.aria-checked]="prefs.mirrored()" (click)="prefs.mirrored.set(!prefs.mirrored())">
            <eras-icon name="layers" />
            <span class="text"><strong>Zonas espejadas</strong><small>Las vidas y las pilas del rival cambian de lado</small></span>
            <span class="state">{{ prefs.mirrored() ? 'Sí' : 'No' }}</span>
          </button>
          <button type="button" class="pref" role="switch" [attr.aria-checked]="!prefs.animationsOff()" (click)="prefs.animationsOff.set(!prefs.animationsOff())">
            <eras-icon name="sparkles" />
            <span class="text"><strong>Animaciones</strong><small>Cartas que vuelan, combates y avisos de turno y fase</small></span>
            <span class="state">{{ prefs.animationsOff() ? 'No' : 'Sí' }}</span>
          </button>
          <button type="button" class="pref" role="switch" [attr.aria-checked]="!prefs.noticesOff()" (click)="prefs.noticesOff.set(!prefs.noticesOff())">
            <eras-icon name="list" />
            <span class="text"><strong>Avisos de las últimas acciones</strong><small>Arriba a la izquierda de la mesa</small></span>
            <span class="state">{{ prefs.noticesOff() ? 'No' : 'Sí' }}</span>
          </button>
        }
        @case ('hand') {
          <button type="button" class="pref" role="switch" [attr.aria-checked]="prefs.straightHand()" (click)="prefs.straightHand.set(!prefs.straightHand())">
            <eras-icon name="cards" />
            <span class="text"><strong>Mano recta</strong><small>Las cartas de la mano en fila, sin curva</small></span>
            <span class="state">{{ prefs.straightHand() ? 'Sí' : 'No' }}</span>
          </button>
          <label class="pref tilt">
            <eras-icon name="hand" />
            <span class="text">
              <strong>Altura de la mano</strong>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                aria-label="Altura de la mano"
                [value]="prefs.handLift()"
                (input)="prefs.handLift.set($any($event.target).valueAsNumber)"
              />
            </span>
          </label>
        }
        @case ('screen') {
          <!-- In a game only (the browser's full screen); the installed app on a phone is always full screen (AppScreen) -->
          @if (screen && screen.fullscreenToggle && (screen.canFullscreen || !screen.installed)) {
            <button type="button" class="pref" role="switch" [attr.aria-checked]="screen.fullView()" (click)="screen.toggleFullscreen()">
              <eras-icon [name]="screen.fullView() ? 'minimize' : 'maximize'" />
              <span class="text"><strong>Pantalla completa</strong><small>Toda la mesa crece con el alto de la pantalla</small></span>
              <span class="state">{{ screen.fullView() ? 'Sí' : 'No' }}</span>
            </button>
          }
          <button type="button" class="pref" role="switch" [attr.aria-checked]="prefs.sidebarDynamic()" (click)="prefs.sidebarDynamic.set(!prefs.sidebarDynamic())">
            <eras-icon name="refresh" />
            <span class="text"><strong>Menú dinámico</strong><small>El menú lateral se expande al pasar el mouse</small></span>
            <span class="state">{{ prefs.sidebarDynamic() ? 'Sí' : 'No' }}</span>
          </button>
        }
        @case ('bots') {
          <!-- The rival's edge, as the hardest bot gets it in Modo solo past its strength: from none up to 8 -->
          <div class="pref static">
            <eras-icon name="trophy" />
            <span class="text">
              <strong>Ventaja del bot</strong>
              @if (edgeText(); as text) {
                <small>{{ text }}</small>
              }
            </span>
            <span class="stepper">
              <button type="button" aria-label="Menos ventaja" [disabled]="edge() <= 0" (click)="game.setBotEdge(edge() - 1)">−</button>
              <b>{{ edge() ? 'nivel ' + edge() : 'ninguna' }}</b>
              <button type="button" aria-label="Más ventaja" [disabled]="edge() >= edgeMax" (click)="game.setBotEdge(edge() + 1)">+</button>
            </span>
          </div>
          <!-- The pause before each bot move: less or more, or each bot's own pace -->
          <div class="pref static">
            <eras-icon name="clock" />
            <span class="text"><strong>Pausa entre jugadas</strong></span>
            <span class="stepper">
              <button type="button" aria-label="Menos pausa" (click)="pace(-250)">−</button>
              <b>{{ paceLabel() }}</b>
              <button type="button" aria-label="Más pausa" (click)="pace(250)">+</button>
              <button type="button" [disabled]="(game.state()?.botDelayMs ?? null) === null" (click)="game.setBotDelay(null)">auto</button>
            </span>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .tabs {
      display: flex;
      gap: var(--space-1);
      margin-block-end: var(--space-3);
      padding: 2px;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-pill);
      background: var(--color-surface-muted);
    }
    .tab {
      display: inline-flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2);
      border: 0;
      border-radius: var(--radius-pill);
      background: none;
      color: var(--color-text-muted);
      font: inherit;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      white-space: nowrap;
      cursor: pointer;
    }
    .tab eras-icon { flex: none; inline-size: 1rem; block-size: 1rem; }
    .tab.on { background: var(--color-primary); color: var(--color-on-primary); }
    .tab:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    /* The same height on every section (the box keeps its size); a longer one scrolls inside */
    .prefs {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      block-size: var(--prefs-height, min(27rem, calc(100dvh - 14rem)));
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .prefs > * { flex: none; }
    .pref {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      inline-size: 100%;
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .pref:hover { background: var(--color-surface-muted); }
    .pref:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .pref[aria-checked='true'] {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
    }
    .pref > eras-icon { flex: none; inline-size: 1.25rem; block-size: 1.25rem; }
    .text { display: flex; flex: 1; flex-direction: column; gap: 0.1rem; min-inline-size: 0; }
    .text small { color: var(--color-text-muted); font-size: var(--font-size-xs); }
    .state { flex: none; color: var(--color-text-muted); font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); text-transform: capitalize; }
    .tilt { cursor: default; }
    .tilt input { inline-size: 100%; margin-block-start: var(--space-1); accent-color: var(--color-primary); cursor: pointer; }
    .static { cursor: default; }
    .static:hover { background: var(--color-surface); }
    .stepper { display: inline-flex; flex: none; align-items: center; gap: var(--space-1); }
    .stepper b { min-inline-size: 4rem; font-size: var(--font-size-sm); text-align: center; }
    .stepper button {
      min-inline-size: 1.75rem;
      padding: 2px 6px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-muted);
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
    }
    .stepper button:disabled { opacity: 0.5; cursor: default; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamePreferencesPanelComponent {
  /** In a game: its bots (in the Sala de pruebas) and the browser's full screen. */
  readonly inGame = input(false, { transform: booleanAttribute });
  /** The site's look first (the profile). */
  readonly withInterface = input(false, { transform: booleanAttribute });

  protected readonly prefs = inject(BoardPreferences);
  protected readonly theme = inject(ThemeService);
  protected readonly game = inject(GameStore);
  /** Only under the board (the game's dialog). */
  protected readonly screen = inject(BoardScreen, { optional: true });

  protected readonly sections = computed(() => {
    const all: { id: Section; label: string; icon: IconName }[] = [];
    if (this.withInterface()) all.push({ id: 'interface', label: 'Interfaz', icon: 'sun' });
    all.push({ id: 'table', label: 'Mesa', icon: 'box' }, { id: 'hand', label: 'Mano', icon: 'hand' }, { id: 'screen', label: 'Pantalla', icon: 'maximize' });
    if (this.inGame() && this.game.editorRoom()) all.push({ id: 'bots', label: 'Bots', icon: 'bot' });
    return all;
  });
  /** The section shown: the first one until another is chosen. */
  protected readonly section = linkedSignal<Section>(() => this.sections()[0].id);

  /** The rival's edge (0: none) and what it does. */
  protected readonly edge = computed(() => this.game.state()?.botEdge ?? 0);
  protected readonly edgeText = computed(() => botEdgeText(this.edge()));
  protected readonly edgeMax = BOT_EDGE_MAX;

  /** The pause before each bot move, in seconds ("auto": each bot's own). */
  protected readonly paceLabel = computed(() => {
    const ms = this.game.state()?.botDelayMs;
    return ms == null ? 'auto' : (ms / 1000).toLocaleString('es', { maximumFractionDigits: 2 }) + ' s';
  });

  protected pace(delta: number): void {
    const now = this.game.state()?.botDelayMs ?? 1000;
    this.game.setBotDelay(Math.max(0, Math.min(10000, now + delta)));
  }
}
