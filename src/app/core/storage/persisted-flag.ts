import { WritableSignal, effect, signal } from '@angular/core';

/**
 * A yes/no preference remembered on this device: a signal that starts from what was stored under {@code key} and
 * stores every change. Call it where `effect` can be used (a component's or service's field). Without storage
 * (private window, blocked) it still works for the page's lifetime.
 */
export function persistedFlag(key: string, initial = false): WritableSignal<boolean> {
  const flag = signal(read(key) ?? initial);
  effect(() => write(key, flag()));
  return flag;
}

function read(key: string): boolean | null {
  try {
    const value = localStorage.getItem(key);
    return value === null ? null : value === '1';
  } catch {
    return null;
  }
}

function write(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // Not remembered (private window, blocked storage)
  }
}
