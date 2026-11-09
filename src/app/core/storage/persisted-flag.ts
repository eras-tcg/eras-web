import { WritableSignal } from '@angular/core';
import { persistedPreference } from './preference-registry';

/**
 * A yes/no preference remembered on this device (and with the account, see PreferenceSync): one signal per key for the
 * whole app, starting from what was stored under {@code key}, storing each value it is set to. Without storage
 * (private window, blocked) it still works for the page's lifetime.
 */
export function persistedFlag(key: string, initial = false): WritableSignal<boolean> {
  return persistedPreference<boolean>(key, initial, (raw) => {
    if (raw === true || raw === '1' || raw === 1 || raw === 'true') return true;
    if (raw === false || raw === '0' || raw === 0 || raw === 'false') return false;
    return null;
  });
}
