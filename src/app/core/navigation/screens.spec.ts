import { describe, expect, it } from 'vitest';
import { navDirection, parentScreen, screenDepth } from './screens';

describe('parentScreen', () => {
  it('has no parent on the home', () => {
    expect(parentScreen('/home')).toBeNull();
  });

  it('places each screen under its hub entry', () => {
    expect(parentScreen('/cards')?.route).toBe('/home');
    expect(parentScreen('/simulator')?.route).toBe('/play');
    expect(parentScreen('/simulator/abc123')?.route).toBe('/play');
    expect(parentScreen('/ruling')?.route).toBe('/play');
    expect(parentScreen('/tierlist')?.route).toBe('/social');
    expect(parentScreen('/booster-result')?.route).toBe('/editions');
    expect(parentScreen('/deck/42')?.route).toBe('/my-decks');
    expect(parentScreen('/roles')?.route).toBe('/admin');
  });

  it('ignores query, fragment and a trailing slash', () => {
    expect(parentScreen('/cards?edition=E1#top')?.route).toBe('/home');
    expect(parentScreen('/public-decks/')?.route).toBe('/social');
  });

  it('hangs unknown paths from the home', () => {
    expect(parentScreen('/nowhere')?.route).toBe('/home');
  });
});

describe('screenDepth', () => {
  it('counts the steps back to the home', () => {
    expect(screenDepth('/home')).toBe(0);
    expect(screenDepth('/play')).toBe(1);
    expect(screenDepth('/simulator')).toBe(2);
    expect(screenDepth('/users-manager')).toBe(2);
  });
});

describe('navDirection', () => {
  it('goes forward into a deeper screen and back out of it', () => {
    expect(navDirection('/home', '/play')).toBe('forward');
    expect(navDirection('/simulator', '/play')).toBe('back');
    expect(navDirection('/cards', '/editions')).toBe('same');
  });
});
