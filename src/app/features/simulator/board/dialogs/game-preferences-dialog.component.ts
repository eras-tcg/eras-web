import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BOT_EDGE_MAX, botEdgeText } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { BoardAnimations } from '../board-animations';
import { BoardPreferences } from '../board-preferences';
import { BoardScreen } from '../board-screen';

/**
 * "Preferencias de partida": how the table looks and behaves (remembered on the device), in sections: the table, the
 * hand, the screen and, in the Sala de pruebas, its bots (their edge and pace, as in the sidebar). Opened under the
 * board's injector (its preferences).
 */
@Component({
  selector: 'eras-game-preferences-dialog',
  imports: [ModalComponent, IconComponent],
  template: `
    <eras-modal title="Preferencias de partida" (closed)="ref.close()">
      <!-- Sections, one at a time -->
      <div class="tabs" role="tablist" aria-label="Secciones">
        @for (t of sections(); track t.id) {
          <button type="button" role="tab" class="tab" [class.on]="section() === t.id" [attr.aria-selected]="section() === t.id" (click)="section.set(t.id)">
            <eras-icon [name]="t.icon" />{{ t.label }}
          </button>
        }
      </div>
      <div class="prefs" role="tabpanel">
        @switch (section()) {
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
            <button type="button" class="pref" role="switch" [attr.aria-checked]="!animations.off()" (click)="animations.off.set(!animations.off())">
              <eras-icon name="sparkles" />
              <span class="text"><strong>Animaciones</strong><small>Cartas que vuelan, combates y avisos de turno y fase</small></span>
              <span class="state">{{ animations.off() ? 'No' : 'Sí' }}</span>
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
            <!-- The installed app on a phone is always full screen (AppScreen); installed on an iPhone it cannot change -->
            @if (screen.fullscreenToggle && (screen.canFullscreen || !screen.installed)) {
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
    </eras-modal>
  `,
  styles: `
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
      cursor: pointer;
    }
    .tab eras-icon { inline-size: 1rem; block-size: 1rem; }
    .tab.on { background: var(--color-primary); color: var(--color-on-primary); }
    .tab:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .prefs { display: flex; flex-direction: column; gap: var(--space-1); }
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
export class GamePreferencesDialogComponent {
  protected readonly ref = inject(DialogRef);
  protected readonly prefs = inject(BoardPreferences);
  protected readonly animations = inject(BoardAnimations);
  protected readonly screen = inject(BoardScreen);
  protected readonly game = inject(GameStore);

  /** The sections: the bots' only in the Sala de pruebas (its owner sets them). */
  protected readonly sections = computed(() => {
    const all: { id: string; label: string; icon: IconName }[] = [
      { id: 'table', label: 'Mesa', icon: 'box' },
      { id: 'hand', label: 'Mano', icon: 'hand' },
      { id: 'screen', label: 'Pantalla', icon: 'maximize' },
    ];
    if (this.game.editorRoom()) all.push({ id: 'bots', label: 'Bots', icon: 'bot' });
    return all;
  });
  protected readonly section = signal('table');

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
