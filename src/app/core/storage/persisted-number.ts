import { WritableSignal, effect, signal } from '@angular/core';

/**
 * A number preference between {@code min} and {@code max} remembered on this device: a signal that starts from what
 * was stored under {@code key} (kept inside the range) and stores every change. Call it where `effect` can be used.
 * Without storage (private window, blocked) it still works for the page's lifetime.
 */
export function persistedNumber(key: string, initial: number, min: number, max: number): WritableSignal<number> {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const value = signal(clamp(read(key) ?? initial));
  effect(() => write(key, value()));
  return value;
}

function read(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function write(key: string, n: number): void {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    // Not remembered (private window, blocked storage)
  }
}
