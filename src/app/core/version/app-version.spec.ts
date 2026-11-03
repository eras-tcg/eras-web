import { describe, expect, it } from 'vitest';
import pkg from '../../../../package.json';
import { APP_VERSION } from './app-version';

describe('APP_VERSION', () => {
  it('is MAIN.FEATURES.FIXES', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('matches package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});
