import { describe, expect, it } from 'vitest';
import { Deck } from '@data/decks/deck.model';
import { Edition } from '@data/editions/edition.model';
import { hubSlides, nextStep, pickBackground } from './hub-rules';
import { NewsItem } from './news';

const edition = (editionId: string, editionImage: string | null = `${editionId}.webp`): Edition => ({ editionId, editionImage });
const deck = (id: string): Deck => ({ id, deckName: id, cards: [] });
const news = (title: string): NewsItem => ({ date: '2026-01-01', dateLabel: '1 ene 2026', title, excerpt: '' });

describe('pickBackground', () => {
  it('only picks editions with artwork', () => {
    expect(pickBackground([edition('A', null), edition('B')], null, () => 0)?.editionId).toBe('B');
    expect(pickBackground([edition('A', null)], null)).toBeNull();
    expect(pickBackground([], null)).toBeNull();
  });

  it('never repeats the previous one when there is another', () => {
    const all = [edition('A'), edition('B')];
    for (const r of [0, 0.5, 0.99]) expect(pickBackground(all, 'A', () => r)?.editionId).toBe('B');
  });

  it('repeats it when it is the only one', () => {
    expect(pickBackground([edition('A')], 'A')?.editionId).toBe('A');
  });

  it('stays in range when random returns its upper edge', () => {
    expect(pickBackground([edition('A'), edition('B')], null, () => 1)?.editionId).toBe('B');
  });
});

describe('hubSlides', () => {
  it('orders edition, decks and news, skipping what is missing', () => {
    const slides = hubSlides(edition('A'), [null, deck('d1'), null, deck('d2')], [news('n1'), news('n2')]);
    expect(slides.map((s) => s.kind)).toEqual(['edition', 'decks', 'news', 'news']);
    expect(slides[1]).toEqual({ kind: 'decks', decks: [deck('d1'), deck('d2')] });
  });

  it('has no edition or deck slide without them', () => {
    expect(hubSlides(null, [null, null], [news('n1')]).map((s) => s.kind)).toEqual(['news']);
  });
});

describe('nextStep', () => {
  it('waits until the decks are known', () => {
    expect(nextStep(null, 0)).toBeNull();
  });

  it('asks for a first deck', () => {
    expect(nextStep(0, 7)?.route).toBe('/deck-builder');
  });

  it('rotates the suggestions by day', () => {
    const routes = [0, 1, 2, 3, 4].map((day) => nextStep(2, day)?.route);
    expect(routes[0]).toBe(routes[4]);
    expect(new Set(routes.slice(0, 4)).size).toBe(4);
    expect(nextStep(2, -1)).not.toBeNull();
  });
});
