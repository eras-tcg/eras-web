import { describe, expect, it } from 'vitest';
import { BoxEntry, Edition } from './edition.model';
import { canSimulateBox, canSimulatePack, compareEditionIds, pickRandomPackFromBox, validateBoxConfig } from './edition-rules';

const entry = (packTypeName: string, mode: BoxEntry['mode'], quantity = 0, probOptions: BoxEntry['probOptions'] = []): BoxEntry => ({
  packTypeName,
  mode,
  quantity,
  probOptions,
});

describe('compareEditionIds', () => {
  it('puts starter decks first, then orders by edition number', () => {
    const ids = ['E2', 'E1.1', 'ST2', 'E1', 'ST1', 'E10'];
    expect([...ids].sort(compareEditionIds)).toEqual(['ST1', 'ST2', 'E1', 'E1.1', 'E2', 'E10']);
  });
});

describe('validateBoxConfig', () => {
  it('accepts an empty box', () => {
    expect(validateBoxConfig({ totalPacks: 24, entries: [] })).toBeNull();
  });

  it('rejects more than one FLEX entry', () => {
    expect(validateBoxConfig({ totalPacks: 24, entries: [entry('A', 'FLEX'), entry('B', 'FLEX')] })).toContain('FLEX');
  });

  it('requires a FLEX entry when there are PROB entries', () => {
    const prob = entry('SR', 'PROB', 0, [{ quantity: 1, prob: 1 }]);
    expect(validateBoxConfig({ totalPacks: 24, entries: [prob] })).toContain('FLEX');
  });

  it('rejects probabilities that do not add up to 1', () => {
    const prob = entry('SR', 'PROB', 0, [
      { quantity: 1, prob: 0.5 },
      { quantity: 2, prob: 0.3 },
    ]);
    expect(validateBoxConfig({ totalPacks: 24, entries: [prob, entry('A', 'FLEX')] })).toContain('0.800');
  });

  it('rejects a minimum that exceeds the box total', () => {
    const entries = [entry('A', 'FIXED', 20), entry('SR', 'PROB', 0, [{ quantity: 5, prob: 1 }]), entry('B', 'FLEX')];
    expect(validateBoxConfig({ totalPacks: 24, entries })).toContain('(25)');
  });

  it('accepts a valid configuration', () => {
    const entries = [
      entry('A', 'FIXED', 10),
      entry('SR', 'PROB', 0, [
        { quantity: 1, prob: 0.75 },
        { quantity: 2, prob: 0.25 },
      ]),
      entry('B', 'FLEX'),
    ];
    expect(validateBoxConfig({ totalPacks: 24, entries })).toBeNull();
  });
});

describe('pickRandomPackFromBox', () => {
  const base: Edition = {
    editionId: 'E1',
    packTypes: [{ name: 'Normal', cardsPerRarity: { C: 5, UC: 3, R: 1, SR: 0, SEC: 0 } }],
  };

  it('falls back to the first pack type without a box config', () => {
    expect(pickRandomPackFromBox(base)).toBe('Normal');
  });

  it('draws from the composed box (FIXED + FLEX fill)', () => {
    const edition: Edition = { ...base, boxConfig: { totalPacks: 4, entries: [entry('Promo', 'FIXED', 1), entry('Normal', 'FLEX')] } };
    // pool = [Promo, Normal, Normal, Normal]
    expect(pickRandomPackFromBox(edition, () => 0)).toBe('Promo');
    expect(pickRandomPackFromBox(edition, () => 0.99)).toBe('Normal');
  });
});

describe('canSimulatePack / canSimulateBox', () => {
  it('needs pack types for a pack and also box entries for a box', () => {
    expect(canSimulatePack({ editionId: 'E1' })).toBe(false);
    const withPacks: Edition = { editionId: 'E1', packTypes: [{ name: 'N', cardsPerRarity: { C: 1, UC: 0, R: 0, SR: 0, SEC: 0 } }] };
    expect(canSimulatePack(withPacks)).toBe(true);
    expect(canSimulateBox(withPacks)).toBe(false);
    expect(canSimulateBox({ ...withPacks, boxConfig: { totalPacks: 1, entries: [entry('N', 'FLEX')] } })).toBe(true);
  });
});
