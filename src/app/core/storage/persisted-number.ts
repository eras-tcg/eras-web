import { WritableSignal } from '@angular/core';
import { persistedPreference } from './preference-registry';

/**
 * A number preference between {@code min} and {@code max} remembered on this device (and with the account, see
 * PreferenceSync): one signal per key for the whole app, starting from what was stored under {@code key} (kept inside
 * the range), storing each value it is set to. Without storage (private window, blocked) it still works for the page's
 * lifetime.
 */
export function persistedNumber(key: string, initial: number, min: number, max: number): WritableSignal<number> {
  return persistedPreference<number>(key, Math.min(max, Math.max(min, initial)), (raw) => {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
  });
}
