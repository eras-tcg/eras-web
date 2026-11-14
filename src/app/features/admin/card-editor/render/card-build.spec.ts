import { cardCode, colorsOf, rolePaint, roleOf, roman, templateFor, wrapText } from './card-build';

describe('card-build', () => {
  it('picks the prototype by type, inheritance, link and white', () => {
    expect(templateFor({ cardType: 'creature', colors: ['P'] })).toBe('CRIATURA - PROTOTIPO');
    expect(templateFor({ cardType: 'creature', colors: ['W'] })).toBe(
      'CRIATURA BLANCA - PROTOTIPO',
    );
    expect(templateFor({ cardType: 'creature', colors: ['W', 'R'] })).toBe('CRIATURA - PROTOTIPO');
    expect(templateFor({ cardType: 'creature', enlace: true })).toBe('CRIATURA ENLACE - PROTOTIPO');
    expect(templateFor({ cardType: 'creature', inheritEffects: [{}] })).toBe(
      'CRIATURA HER - PROTOTIPO',
    );
    expect(templateFor({ cardType: 'utility', colors: ['W'] })).toBe('UTILIDAD BLANCA - PROTOTIPO');
    expect(
      templateFor({ cardType: 'structure', inheritKeywordEffects: [{ keyword: 'Furia' }] }),
    ).toBe('ESTRUCTURA HER - PROTOTIPO');
  });

  it('reads one or two known colors', () => {
    expect(colorsOf({ colors: ['R', 'B', 'G'] })).toEqual(['R', 'B']);
    expect(colorsOf({ colorIdentity: 'G' })).toEqual(['G']);
    expect(colorsOf({ colors: ['X', 'P'] })).toEqual(['P']);
  });

  it('writes levels in roman numerals and builds the code', () => {
    expect(roman(3)).toBe('III');
    expect(roman(null)).toBe('');
    expect(cardCode({ edition: 'E1', colorIdentity: 'P', cardNumber: 4 })).toBe('E1-P04');
    expect(cardCode({ code: 'ST2-G10' })).toBe('ST2-G10');
  });

  it('paints a role flat for one color and blended for two', () => {
    expect(roleOf('Type Frame')).toBe('primary');
    expect(roleOf('BACK EFFECT copia 2')).toBe('effectBg');
    expect(roleOf('Polígono 1')).toBeNull();
    expect(rolePaint('primary', ['R'])).toBe('#990608');
    const blend = rolePaint('primary', ['P', 'W']);
    expect(typeof blend === 'object' && blend?.gradient.stops.map((s) => s.color)).toEqual([
      '#441fea',
      '#ffffff',
    ]);
    const margin = rolePaint('margin', ['P', 'W']);
    expect(typeof margin === 'object' && margin?.gradient.stops.map((s) => s.color)).toEqual([
      '#835aff',
      '#ebf3f3',
    ]);
    const flipped = rolePaint('primary', ['W', 'P']);
    expect(typeof flipped === 'object' && flipped?.gradient.stops.map((s) => s.color)).toEqual([
      '#ffffff',
      '#441fea',
    ]);
    expect(typeof flipped === 'object' && flipped?.gradient.scale).toBe(20);
    const bg = rolePaint('effectBg', ['G', 'B']);
    expect(
      typeof bg === 'object' && [bg?.gradient.scale, ...bg!.gradient.stops.map((s) => s.color)],
    ).toEqual([100, '#affdac', '#afc7f6']);
  });

  it('wraps words by measured width', () => {
    const measure = (t: string) => t.length * 10;
    expect(wrapText('uno dos tres cuatro', 'x', 75, measure)).toEqual([
      'uno dos',
      'tres',
      'cuatro',
    ]);
  });
});
