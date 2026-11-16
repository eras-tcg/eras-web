import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetPreferencesForTests } from '@core/storage/preference-registry';
import { optionalModePreference } from './optional-mode';
import { optionalModeOf } from './simulator.model';

describe('optional effects mode', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPreferencesForTests();
  });
  afterEach(() => resetPreferencesForTests());

  it('starts in Auto for a player who never chose', () => {
    expect(optionalModePreference()()).toBe('auto');
  });

  it('keeps Off for a player who had the old switch on', () => {
    localStorage.setItem('eras-sim-optional-off', '1');
    expect(optionalModePreference()()).toBe('off');
  });

  it('remembers the mode chosen', () => {
    optionalModePreference().set('on');
    resetPreferencesForTests();
    expect(optionalModePreference()()).toBe('on');
  });

  it('reads the mode the server has for a player', () => {
    expect(optionalModeOf({})).toBe('on');
    expect(optionalModeOf({ autoOptional: true })).toBe('auto');
    expect(optionalModeOf({ skipOptional: true, autoOptional: true })).toBe('off');
  });
});
