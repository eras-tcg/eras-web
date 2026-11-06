import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { BoardAnimations } from '../board-animations';
import { BoardPreferences } from '../board-preferences';
import { BoardScreen } from '../board-screen';

/**
 * "Preferencias de partida": how the table looks and behaves, remembered on the device. They are not part of the
 * game itself, so they live here instead of the sidebar. Opened under the board's injector (its preferences).
 */
@Component({
  selector: 'eras-game-preferences-dialog',
  imports: [ModalComponent, IconComponent],
  template: `
    <eras-modal title="Preferencias de partida" subtitle="Se recuerdan en este dispositivo" (closed)="ref.close()">
      <div class="prefs">
        <span class="group">Mesa</span>
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
        <button type="button" class="pref" role="switch" [attr.aria-checked]="prefs.straightHand()" (click)="prefs.straightHand.set(!prefs.straightHand())">
          <eras-icon name="cards" />
          <span class="text"><strong>Mano recta</strong><small>Las cartas de la mano en fila, sin curva</small></span>
          <span class="state">{{ prefs.straightHand() ? 'Sí' : 'No' }}</span>
        </button>
        <button type="button" class="pref" role="switch" [attr.aria-checked]="prefs.mirrored()" (click)="prefs.mirrored.set(!prefs.mirrored())">
          <eras-icon name="layers" />
          <span class="text"><strong>Zonas espejadas</strong><small>Las vidas y las pilas del rival cambian de lado</small></span>
          <span class="state">{{ prefs.mirrored() ? 'Sí' : 'No' }}</span>
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

        <span class="group">Pantalla</span>
        <!-- Installed on an iPhone it is already full screen and there is nothing to toggle -->
        @if (screen.canFullscreen || !screen.installed) {
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
      </div>
    </eras-modal>
  `,
  styles: `
    .prefs { display: flex; flex-direction: column; gap: var(--space-1); }
    .group {
      margin-block-start: var(--space-2);
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .group:first-child { margin-block-start: 0; }
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamePreferencesDialogComponent {
  protected readonly ref = inject(DialogRef);
  protected readonly prefs = inject(BoardPreferences);
  protected readonly animations = inject(BoardAnimations);
  protected readonly screen = inject(BoardScreen);
}
