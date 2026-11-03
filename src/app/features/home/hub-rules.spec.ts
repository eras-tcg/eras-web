import { describe, expect, it } from 'vitest';
import { Edition } from '@data/editions/edition.model';
import { hubSlides, nextStep, pickBackground, welcomeNextStep } from './hub-rules';
import { NewsItem } from './news';

const edition = (editionId: string, editionImage: string | null = `${editionId}.webp`): Edition => ({ editionId, editionImage });
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
  it('puts the edition before the news', () => {
    expect(hubSlides(edition('A'), [news('n1'), news('n2')]).map((s) => s.kind)).toEqual(['edition', 'news', 'news']);
  });

  it('illustrates a news item with its edition artwork when known', () => {
    const item = { ...news('n1'), editionId: 'A' };
    expect(hubSlides(null, [item], [edition('A')])[0]).toEqual({ kind: 'news', news: item, image: 'A.webp' });
    expect(hubSlides(null, [item], [edition('B')])[0]).toEqual({ kind: 'news', news: item, image: null });
    expect(hubSlides(null, [news('n2')], [edition('A')])[0]).toEqual({ kind: 'news', news: news('n2'), image: null });
  });

  it('has no edition slide without one', () => {
    expect(hubSlides(null, [news('n1')]).map((s) => s.kind)).toEqual(['news']);
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

describe('welcomeNextStep', () => {
  const step = (id: string, progress: number, claimed = false) => ({ id, progress, target: 1, gems: 100, claimed, locked: false });

  it('goes where the current step is done, or to the missions once it can be claimed', () => {
    expect(welcomeNextStep([step('welcome', 1, true), step('deck', 0)])).toEqual(expect.objectContaining({ route: '/deck-builder', action: 'Ir' }));
    expect(welcomeNextStep([step('welcome', 1, true), step('deck', 1)])).toEqual(expect.objectContaining({ route: '/missions', action: 'Reclamar' }));
  });

  it('opens the greeting and the structure deck picker as dialogs', () => {
    expect(welcomeNextStep([step('welcome', 1)])?.flow).toBe('welcome');
    expect(welcomeNextStep([step('welcome', 1, true), { ...step('structure', 0), gems: 0 }])?.flow).toBe('structure');
  });

  it('suggests nothing once the chain is complete or while unknown', () => {
    expect(welcomeNextStep([step('welcome', 1, true)])).toBeNull();
    expect(welcomeNextStep(null)).toBeNull();
  });
});
