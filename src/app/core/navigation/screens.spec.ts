import { describe, expect, it } from 'vitest';
import { isAdminScreen, navDirection, parentScreen, screenDepth } from './screens';

describe('parentScreen', () => {
  it('has no parent on the home', () => {
    expect(parentScreen('/home')).toBeNull();
  });

  it('places each screen under its hub entry', () => {
    expect(parentScreen('/library')?.route).toBe('/home');
    expect(parentScreen('/cards')?.route).toBe('/library');
    expect(parentScreen('/cards/editions')?.route).toBe('/library');
    expect(parentScreen('/simulator')?.route).toBe('/play');
    expect(parentScreen('/simulator/abc123')?.route).toBe('/play');
    expect(parentScreen('/ruling')?.route).toBe('/play');
    expect(parentScreen('/tierlist')?.route).toBe('/social');
    expect(parentScreen('/booster-result')?.route).toBe('/editions');
    expect(parentScreen('/editions/E1.2')?.route).toBe('/editions');
    expect(parentScreen('/deck/42')?.route).toBe('/my-decks');
    expect(parentScreen('/roles')?.route).toBe('/admin');
    expect(parentScreen('/cards/collection')?.route).toBe('/library');
    expect(parentScreen('/cards/collection/E1.3')?.route).toBe('/cards/collection');
    expect(parentScreen('/profile/history')?.route).toBe('/profile');
    expect(parentScreen('/profile/history/rival-deck')?.route).toBe('/profile/history');
  });

  it('ignores query, fragment and a trailing slash', () => {
    expect(parentScreen('/cards?edition=E1#top')?.route).toBe('/library');
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
    expect(navDirection('/library', '/editions')).toBe('same');
    expect(navDirection('/library', '/cards')).toBe('forward');
  });
});

describe('isAdminScreen', () => {
  it('is administration and its tools, and nothing of the game', () => {
    expect(isAdminScreen('/admin')).toBe(true);
    expect(isAdminScreen('/users-manager?page=2')).toBe(true);
    expect(isAdminScreen('/card-ref')).toBe(true);
    expect(isAdminScreen('/home')).toBe(false);
    expect(isAdminScreen('/cards')).toBe(false);
  });
});
