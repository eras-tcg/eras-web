import { describe, expect, it } from 'vitest';
import { Edition } from '@data/editions/edition.model';
import { editionLink, hubSlides, nextStep, pickBackground, welcomeNextStep } from './hub-rules';
import { CatalogCard } from '@data/cards/card.model';
import { HomeNews } from '@data/home/home.model';

const edition = (editionId: string, editionImage: string | null = `${editionId}.webp`): Edition => ({ editionId, editionImage });
const news = (title: string, cardIds: string[] = [], over: Partial<HomeNews> = {}): HomeNews => ({ date: '2026-11-04T20:00', title, excerpt: '', cardIds, ...over });
const card = (id: string, edition: string, rarity: string, number = 1): CatalogCard => ({
  id, name: id, edition, sub_edition: '', number, color_identity: 'R', image_url: `${id}.jpg`, time_stamp: null, meta: { id: `m-${id}`, cardName: id, rarity },
});

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
  const cards = [card('c', 'A', 'C', 3), card('sec', 'A', 'SEC', 9), card('r', 'A', 'R', 2), card('sr', 'A', 'SR', 5), card('other', 'B', 'SEC')];

  it('puts the edition before the news', () => {
    expect(hubSlides(edition('A'), [news('n1'), news('n2')]).map((s) => s.title)).toEqual(['A', 'n1', 'n2']);
  });

  it("shows the featured edition with its three rarest cards and a button to its page", () => {
    const [slide] = hubSlides(edition('A'), [], cards);
    expect(slide.kind).toBe('edition');
    expect(slide.cards.map((c) => c.id)).toEqual(['sec', 'sr', 'r']);
    expect(slide.action).toEqual({ label: 'Ver edición', url: '/editions/A' });
  });

  it("sends a news link to an edition's cards to the edition's page", () => {
    expect(editionLink('/cards?edition=E1.3')).toBe('/editions/E1.3');
    expect(editionLink('/cards?edition=E1&color=R')).toBe('/cards?edition=E1&color=R');
    expect(editionLink('/deck-builder')).toBe('/deck-builder');
    const [slide] = hubSlides(null, [news('n', [], { linkRoute: '/cards?edition=E1.3', linkLabel: 'Ver' })], cards);
    expect(slide.kind).toBe('news');
    expect(slide.action).toEqual({ label: 'Ver', url: '/editions/E1.3' });
  });

  it("shows a news item with its own cards, in its order, and its button when it has one", () => {
    const [slide] = hubSlides(null, [news('n1', ['r', 'missing', 'sec'], { linkRoute: '/editions', linkLabel: 'A la tienda' })], cards);
    expect(slide.cards.map((c) => c.id)).toEqual(['r', 'sec']);
    expect(slide.action).toEqual({ label: 'A la tienda', url: '/editions' });
    expect(slide.eyebrow).toBe('mié 4 nov');
    expect(hubSlides(null, [news('n2')], cards)[0].action).toBeNull();
  });

  it('has no edition slide without one', () => {
    expect(hubSlides(null, [news('n1')]).map((s) => s.title)).toEqual(['n1']);
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
