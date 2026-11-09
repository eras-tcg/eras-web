import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { persistedFlag } from './persisted-flag';
import { persistedNumber } from './persisted-number';
import { applyPreference, onPreferenceChange, resetPreferencesForTests, storedPreferences } from './preference-registry';

describe('preference registry', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPreferencesForTests();
  });
  afterEach(() => resetPreferencesForTests());

  it('gives one signal per key to the whole app', () => {
    const a = persistedFlag('test-flag');
    const b = persistedFlag('test-flag');
    a.set(true);
    expect(b()).toBe(true);
    expect(a).toBe(b);
  });

  it('stores what the player sets and tells the listeners', () => {
    const changed: string[] = [];
    onPreferenceChange((k) => changed.push(k));
    const n = persistedNumber('test-number', 0.4, 0, 1);
    n.set(0.8);
    expect(localStorage.getItem('test-number')).toBe('0.8');
    expect(changed).toEqual(['test-number']);
    expect(storedPreferences()).toEqual({ 'test-number': 0.8 });
  });

  it('starts from the stored value, kept in its range', () => {
    localStorage.setItem('test-number', '7');
    expect(persistedNumber('test-number', 0.4, 0, 1)()).toBe(1);
  });

  it('applies what the account has without telling it back', () => {
    const changed: string[] = [];
    onPreferenceChange((k) => changed.push(k));
    const f = persistedFlag('test-flag');
    applyPreference('test-flag', true);
    expect(f()).toBe(true);
    expect(localStorage.getItem('test-flag')).toBe('1');
    expect(changed).toEqual([]);
  });

  it('keeps a preference no page uses yet on the device until one does', () => {
    applyPreference('test-later', 0.25);
    expect(persistedNumber('test-later', 0, 0, 1)()).toBe(0.25);
  });

  it('does not count a preference the player never set as stored', () => {
    persistedFlag('test-untouched', true);
    expect(storedPreferences()).toEqual({});
  });
});
