import { WritableSignal, signal } from '@angular/core';

/** A preference's value: what the account keeps (DriveManager: text, number or yes/no). */
export type PreferenceValue = string | number | boolean;

interface Entry {
  readonly signal: WritableSignal<PreferenceValue>;
  /** Takes a value read from the account (or another device), without telling the account back. */
  apply(raw: unknown): void;
}

const entries = new Map<string, Entry>();
const listeners = new Set<(key: string) => void>();

/**
 * One preference remembered on this device under `key` (the account keeps it too, see PreferenceSync): a signal that
 * starts from what was stored, stores each value it is set to, and tells the listeners. One signal per key for the
 * whole app (asked twice, the same one), so every page that shows the preference shows the same value. Without storage
 * (private window, blocked) it still works for the page's lifetime.
 *
 * @param decode reads a stored or received value (null: not a valid one)
 */
export function persistedPreference<T extends PreferenceValue>(key: string, initial: T, decode: (raw: unknown) => T | null): WritableSignal<T> {
  const known = entries.get(key);
  if (known) return known.signal as unknown as WritableSignal<T>;
  const value = signal<T>(decode(readStored(key)) ?? initial);
  const set = value.set.bind(value);
  const store = (next: T) => {
    const clean = decode(next) ?? initial;
    set(clean);
    writeStored(key, clean);
    return clean;
  };
  value.set = (next: T) => {
    if (Object.is(value(), next)) return;
    store(next);
    listeners.forEach((l) => l(key));
  };
  value.update = (fn: (v: T) => T) => value.set(fn(value()));
  entries.set(key, {
    signal: value as unknown as WritableSignal<PreferenceValue>,
    apply: (raw) => {
      const v = decode(raw);
      if (v !== null && !Object.is(value(), v)) store(v);
    },
  });
  return value;
}

/** A value from the account: into its signal if a page uses it already, else kept on the device until one does. */
export function applyPreference(key: string, raw: unknown): void {
  const entry = entries.get(key);
  if (entry) entry.apply(raw);
  else if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') writeStored(key, raw);
}

/** The preferences this device has stored (set by the player), with their values now. */
export function storedPreferences(): Record<string, PreferenceValue> {
  const out: Record<string, PreferenceValue> = {};
  for (const [key, entry] of entries) {
    if (readStored(key) !== null) out[key] = entry.signal();
  }
  return out;
}

/** Called each time the player changes a preference (not when one is applied from the account). */
export function onPreferenceChange(listener: (key: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: PreferenceValue): void {
  try {
    localStorage.setItem(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  } catch {
    // Not remembered (private window, blocked storage)
  }
}

/** Tests: forget every preference (each test starts from the storage as it left it). */
export function resetPreferencesForTests(): void {
  entries.clear();
  listeners.clear();
}
