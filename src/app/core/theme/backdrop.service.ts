import { Injectable, computed } from '@angular/core';
import { persistedPreference } from '@core/storage/preference-registry';

/** The background behind the screens: the vortex turning with its gem dust, the vortex still, or a plain color. */
export type BackdropMode = 'moving' | 'still' | 'flat';

export const BACKDROP_MODES: readonly BackdropMode[] = ['moving', 'still', 'flat'];

/** Its name in the preferences. */
export const BACKDROP_LABELS: Record<BackdropMode, string> = { moving: 'Animado', still: 'Estático', flat: 'Plano' };

const BACKDROP_KEY = 'eras-backdrop';

/** The next mode in the preference's cycle (Animado → Estático → Plano → Animado). */
export function nextBackdrop(mode: BackdropMode): BackdropMode {
  return BACKDROP_MODES[(BACKDROP_MODES.indexOf(mode) + 1) % BACKDROP_MODES.length];
}

/**
 * The player's choice of background (AmbientBackdrop): remembered on the device and with the account
 * (PreferenceSync); animated until chosen otherwise.
 */
@Injectable({ providedIn: 'root' })
export class BackdropService {
  readonly mode = persistedPreference<BackdropMode>(BACKDROP_KEY, 'moving', (raw) =>
    BACKDROP_MODES.includes(raw as BackdropMode) ? (raw as BackdropMode) : null,
  );
  readonly label = computed(() => BACKDROP_LABELS[this.mode()]);

  cycle(): void {
    this.mode.update(nextBackdrop);
  }
}
