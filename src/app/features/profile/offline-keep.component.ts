import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppOffline } from '@core/pwa/app-offline';
import { OfflinePicturesAuto } from '@data/simulator/offline-pictures-auto';

/**
 * "Guardar el juego para jugar sin conexión", in the profile's preferences: turned on, this device downloads what an
 * offline game needs (the app itself and the card pictures of the starter decks and the saved decks) at once and then
 * by itself after each sync, like the installed app always does (there it shows on, fixed). The state below: how many
 * pictures are kept, or the download's progress.
 */
@Component({
  selector: 'eras-offline-keep',
  template: `
    <label class="eras-form-field__text" [title]="auto.app ? 'La app lo guarda sola' : ''">
      <input type="checkbox" [checked]="auto.app || auto.wanted()" [disabled]="auto.app || !auto.canKeep" (change)="toggle($any($event.target).checked)" />
      Guardar el juego para jugar sin conexión
    </label>
    <p class="state">
      @if (!auto.canKeep) {
        Este navegador no permite guardar las imágenes de las cartas.
      } @else if (auto.progress(); as p) {
        Descargando imágenes: {{ p.done }} de {{ p.total }}…
      } @else if (auto.app || auto.wanted()) {
        @if (auto.kept(); as k) {
          {{ k.kept === k.total ? 'Todo guardado' : k.kept + ' de ' + k.total + ' imágenes guardadas' }}: juegas contra el bot sin internet.
        }
      } @else {
        Descarga los mazos iniciales, tus mazos y sus cartas, y sigue al día con lo que agregues.
      }
    </p>
  `,
  styles: `
    :host { display: grid; gap: var(--space-1); }
    .state { margin: 0; padding-inline-start: calc(1.1rem + var(--space-2)); color: var(--color-text-subtle); font-size: var(--font-size-xs); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflineKeepComponent {
  protected readonly auto = inject(OfflinePicturesAuto);
  private readonly appOffline = inject(AppOffline);

  constructor() {
    if (this.auto.app || this.auto.wanted()) void this.auto.count();
  }

  protected toggle(on: boolean): void {
    this.auto.wanted.set(on);
    if (!on) return;
    // The app itself too (the service worker), then the pictures now
    void this.appOffline.ensureRegistered();
    void this.auto.run(true);
  }
}
