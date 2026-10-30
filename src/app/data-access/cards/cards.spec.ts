import { describe, expect, it } from 'vitest';
import { CardMeta, CardRefData, CatalogCard, DriveCard } from './card.model';
import { EMPTY_FILTERS, filterCards, hasActiveFilters, sortCards } from './card-filters';
import { cardImageUrl, collapseByName, mergeCards, nameVariants, renderEffect, renderKeywordEffect } from './card-rules';

const drive = (over: Partial<DriveCard> = {}): DriveCard => ({
  id: 'd1',
  name: 'Eisten',
  edition: 'ST1',
  sub_edition: '',
  number: 1,
  color_identity: 'B',
  image_url: 'https://img/1.jpg',
  time_stamp: null,
  ...over,
});
const card = (over: Partial<CatalogCard> = {}, meta: Partial<CardMeta> | null = {}): CatalogCard => ({
  ...drive(over),
  meta: meta === null ? null : { id: 'm', ...meta },
  ...('meta' in over ? { meta: over.meta ?? null } : {}),
});

describe('mergeCards', () => {
  it('joins by edition, number, sub-edition and color', () => {
    const meta: CardMeta[] = [
      { id: 'm1', edition: 'ST1', cardNumber: 1, subEdition: null, colorIdentity: 'B', cost: 2 },
      { id: 'm2', edition: 'ST1', cardNumber: 1, subEdition: null, colorIdentity: 'R' },
    ];
    const [merged, orphan] = mergeCards([drive(), drive({ id: 'd2', number: 9 })], meta);
    expect(merged.meta?.id).toBe('m1');
    expect(orphan.meta).toBeNull();
  });

  it("takes the metadata's name: the file name has no real hyphens", () => {
    const meta: CardMeta[] = [{ id: 'm1', edition: 'ST1', cardNumber: 1, subEdition: null, colorIdentity: 'B', cardName: 'Roto-G0' }];
    const [named, unnamed] = mergeCards([drive({ name: 'Roto G0' }), drive({ id: 'd2', number: 9, name: 'Nueva Carta' })], meta);
    expect(named.name).toBe('Roto-G0');
    expect(unnamed.name).toBe('Nueva Carta');
  });
});

describe('cardImageUrl', () => {
  it('adds the timestamp as cache-buster', () => {
    expect(cardImageUrl({ image_url: 'u', time_stamp: '2026-01-01T00:00:00Z' })).toBe('u?v=1767225600000');
    expect(cardImageUrl({ image_url: 'u', time_stamp: null })).toBe('u');
    expect(cardImageUrl({ image_url: null, time_stamp: null })).toBeNull();
  });
  it('keeps the version the backend already put in the URL', () => {
    expect(cardImageUrl({ image_url: 'u?v=1767225600', time_stamp: '2026-01-01T00:00:00Z' })).toBe('u?v=1767225600');
  });
});

describe('filterCards', () => {
  const cards = [
    card({ id: 'a', name: 'Albigio', edition: 'E1', number: 4, color_identity: 'P' }, { cost: 1, rarity: 'R', cardType: 'creature', colors: ['P', 'G'] }),
    card({ id: 'b', name: 'Eisten', edition: 'ST1', number: 1 }, { cost: 5, rarity: 'C', cardType: 'utility', specialCost: 2 }),
    card({ id: 'c', name: 'Sin meta', edition: 'E1', sub_edition: '1', number: 7, meta: null }),
  ];
  const ids = (list: CatalogCard[]) => list.map((c) => c.id);

  it('hides cards without metadata unless asked', () => {
    expect(ids(filterCards(cards, EMPTY_FILTERS, false))).toEqual(['a', 'b']);
    expect(ids(filterCards(cards, EMPTY_FILTERS, true))).toEqual(['a', 'b', 'c']);
  });

  it('filters by edition, including sub-editions', () => {
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, edition: 'E1' }, true))).toEqual(['a']);
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, edition: 'E1.1' }, true))).toEqual(['c']);
  });

  it('name accepts regex and falls back on invalid patterns', () => {
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, name: '^alb' }, false))).toEqual(['a']);
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, name: 'eis(' }, false))).toEqual([]);
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, name: 'ten' }, false))).toEqual(['b']);
  });

  it('matches extra colors only in "any" mode', () => {
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, colors: ['G'] }, false))).toEqual(['a']);
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, colors: ['G'], colorMode: 'identity' }, false))).toEqual([]);
  });

  it('applies ranges, rarity and type', () => {
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, cost: { min: 2, max: null } }, false))).toEqual(['b']);
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, rarities: ['R'] }, false))).toEqual(['a']);
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, type: 'UTILITY' }, false))).toEqual(['b']);
  });

  it('special cost range hides cards without special cost', () => {
    expect(ids(filterCards(cards, { ...EMPTY_FILTERS, specialCost: { min: 0, max: 5 } }, false))).toEqual(['b']);
  });

  it('matches keyword filters against parameterized keywords', () => {
    const withKw = card({ id: 'k' }, { keywordEffects: [{ keyword: 'Provocar {nivel}', number: '4' }] });
    expect(ids(filterCards([withKw], { ...EMPTY_FILTERS, keywords: ['Provocar'] }, false))).toEqual(['k']);
  });

  it('reports active filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, cost: { min: null, max: 3 } })).toBe(true);
  });
});

describe('sortCards', () => {
  it('sorts by key and direction, missing values last', () => {
    const list = [card({ id: 'x' }, { cost: 3 }), card({ id: 'y' }, { cost: null }), card({ id: 'z' }, { cost: 1 })];
    expect(sortCards(list, 'cost', 'asc').map((c) => c.id)).toEqual(['z', 'x', 'y']);
    expect(sortCards(list, 'cost', 'desc').map((c) => c.id)).toEqual(['y', 'x', 'z']);
  });
});

describe('collapseByName / nameVariants', () => {
  const dates = new Map([
    ['ST1', '2026-01-01'],
    ['E1', '2026-03-01'],
  ]);
  const old = card({ id: 'old', name: 'Eisten', edition: 'ST1' });
  const recent = card({ id: 'new', name: 'eisten', edition: 'E1' });
  const other = card({ id: 'other', name: 'Albigio', edition: 'ST1' });

  it('keeps the newest printing per name', () => {
    expect(collapseByName([old, recent, other], dates).map((c) => c.id)).toEqual(['new', 'other']);
  });

  it('lists printings newest first', () => {
    expect(nameVariants(old, [old, recent, other], dates).map((c) => c.id)).toEqual(['new', 'old']);
  });
});

describe('renderEffect', () => {
  const ref: CardRefData = { keywordEffects: { Celeridad: { displayText: 'puede atacar el turno en que entra' }, Provocar: { displayText: 'nivel {nivel} o menor' } } };

  it('builds text and keyword segments with keyword notes', () => {
    const line = renderEffect(
      {
        instance: 'En Invocación',
        ussageLimit: 'once per turn',
        effectBlocks: [{ activationCondition: 'por efecto', cost: '', resolution: '[[Celeridad]].' }],
        tags: ['ofensivo'],
      },
      ref,
    );
    expect(line.segments.map((s) => s.text).join('')).toBe(
      '<En Invocación> [una vez por turno] por efecto: Celeridad. (Celeridad: puede atacar el turno en que entra)',
    );
    expect(line.segments.find((s) => s.kind === 'keyword')?.text).toBe('Celeridad');
    expect(line.tags).toEqual(['ofensivo']);
  });

  it('never produces markup from card text', () => {
    const line = renderEffect({ effectBlocks: [{ resolution: '<img onerror=x>' }] }, null);
    expect(line.segments).toEqual([{ kind: 'text', text: '<img onerror=x>' }]);
  });

  it('describes parameterized keyword effects', () => {
    const line = renderKeywordEffect({ keyword: 'Provocar {nivel}', number: '4' }, ref);
    expect(line.segments.map((s) => s.text).join('')).toBe('Provocar 4 (nivel 4 o menor)');
  });
});
