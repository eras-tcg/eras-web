import { TestBed } from '@angular/core/testing';
import { resetPreferencesForTests } from '@core/storage/preference-registry';
import { BackdropService, nextBackdrop } from './backdrop.service';

describe('BackdropService', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPreferencesForTests();
  });

  it('cycles Animado → Estático → Plano → Animado', () => {
    expect(nextBackdrop('moving')).toBe('still');
    expect(nextBackdrop('still')).toBe('flat');
    expect(nextBackdrop('flat')).toBe('moving');
  });

  it('starts animated and names the mode chosen', () => {
    const backdrop = TestBed.inject(BackdropService);
    expect(backdrop.mode()).toBe('moving');
    backdrop.cycle();
    expect(backdrop.mode()).toBe('still');
    expect(backdrop.label()).toBe('Estático');
  });
});
