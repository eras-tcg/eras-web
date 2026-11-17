import { WritableSignal } from '@angular/core';
import { persistedFlag } from '@core/storage/persisted-flag';
import { persistedPreference } from '@core/storage/preference-registry';
import { OptionalMode } from './simulator.model';

/**
 * The player's optional effects mode, remembered as a preference. A player who never chose starts in Auto; one who had the
 * old switch on ("Opcionales apagados") starts in Off.
 */
export function optionalModePreference(): WritableSignal<OptionalMode> {
  return persistedPreference<OptionalMode>(
    'eras-sim-optional-mode',
    persistedFlag('eras-sim-optional-off')() ? 'off' : 'auto',
    (raw) => (raw === 'on' || raw === 'auto' || raw === 'off' ? raw : null),
  );
}
