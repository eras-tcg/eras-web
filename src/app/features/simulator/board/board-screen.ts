import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AppScreen } from '@core/pwa/app-screen';
import { ModalService } from '@ui/surfaces/modal/modal.service';

/**
 * The board's screen: browser full screen (the field cards get the extra room), installed on the home screen, and the
 * phone held in landscape while full screen. Provided by the board page.
 */
@Injectable()
export class BoardScreen {
  private readonly document = inject(DOCUMENT);
  private readonly modal = inject(ModalService);

  /** Browser full screen. */
  readonly fullscreen = signal(false);
  /** Opened from the home screen (installed): no browser bars already, so it counts as full screen. */
  readonly installed =
    !!this.document.defaultView?.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches ||
    (this.document.defaultView?.navigator as { standalone?: boolean } | undefined)?.standalone === true;
  /** iPhone's Safari has no full screen for pages: there the button explains how to install it instead. */
  readonly canFullscreen = this.document.fullscreenEnabled;
  /** Its "Pantalla completa" switch: not in the installed app on a phone or tablet (always full screen: AppScreen). */
  readonly fullscreenToggle = inject(AppScreen).fullscreenToggle;
  readonly fullView = computed(() => this.fullscreen() || this.installed);

  constructor() {
    const onChange = () => this.fullscreen.set(!!this.document.fullscreenElement);
    this.document.addEventListener('fullscreenchange', onChange);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.document.removeEventListener('fullscreenchange', onChange));
    // Phones in the browser: the table stays in landscape while full screen (only Android allows it; elsewhere it
    // is refused and nothing changes). Back to free rotation outside the table. The installed app is always in
    // landscape (AppScreen): it is never unlocked here
    if (this.installed) return;
    const orientation = this.document.defaultView?.screen?.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    effect(() => {
      if (this.fullView()) orientation?.lock?.('landscape').catch(() => undefined);
      else orientation?.unlock?.();
    });
    destroyRef.onDestroy(() => orientation?.unlock?.());
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.canFullscreen) {
      await this.modal.confirm({
        title: 'Pantalla completa',
        message:
          'Este navegador no permite pantalla completa en una página. Para jugar sin las barras del navegador, toca ' +
          'Compartir → "Agregar a pantalla de inicio" y abre ERAS desde ese ícono.',
        confirmLabel: 'Entendido',
      });
      return;
    }
    try {
      if (this.document.fullscreenElement) await this.document.exitFullscreen();
      else await this.document.documentElement.requestFullscreen();
    } catch {
      // The browser refused it (no user gesture, not allowed): nothing changes
    }
  }
}
