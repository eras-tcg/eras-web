import { describe, expect, it } from 'vitest';
import { applyPlaceholder, cleanEffect, effectSummary } from './effect-rules';

describe('effectSummary', () => {
  it('mirrors the backend plain text', () => {
    expect(
      effectSummary({
        instance: 'Todos Los Turnos',
        ussageLimit: 'once per turn',
        effectBlocks: [{ activationCondition: 'al entrar', cost: 'paga 1', resolution: 'roba 1.' }],
      }),
    ).toBe('<Todos Los Turnos> [once per turn] al entrar: paga 1; roba 1.');
    expect(effectSummary(null)).toBe('');
  });
});

describe('cleanEffect', () => {
  it('trims, drops empty blocks and normalizes empty selects to null', () => {
    expect(
      cleanEffect({ instance: '', kind: 'disparado', tags: ['a'], effectBlocks: [{ activationCondition: '  x ', cost: '', resolution: '' }, { resolution: '  ' }] }),
    ).toEqual({ instance: null, ussageLimit: null, kind: 'disparado', tags: ['a'], effectBlocks: [{ activationCondition: 'x', cost: '', resolution: '' }] });
    expect(cleanEffect({ effectBlocks: [] }).effectBlocks).toHaveLength(1);
  });
});

describe('applyPlaceholder', () => {
  it('turns @ into {name} in the keyword and the effect text', () => {
    const out = applyPlaceholder('Provocar @', { effectBlocks: [{ cost: 'nivel @ o menor', resolution: 'agota' }] }, 'nivel');
    expect(out.keyword).toBe('Provocar {nivel}');
    expect(out.effect.effectBlocks?.[0]).toEqual({ activationCondition: undefined, cost: 'nivel {nivel} o menor', resolution: 'agota' });
  });

  it('leaves everything as is without a placeholder name', () => {
    const effect = { effectBlocks: [{ resolution: 'paga @' }] };
    expect(applyPlaceholder(' Celeridad ', effect, '')).toEqual({ keyword: 'Celeridad', effect });
  });
});
