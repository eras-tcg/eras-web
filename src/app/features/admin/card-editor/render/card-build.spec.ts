import {
  sideOf,
  cardCode,
  colorsOf,
  rolePaint,
  roleOf,
  roman,
  squeezeToFit,
  textSpan,
  templateFor,
  wrapText,
} from './card-build';

describe('card-build', () => {
  it('picks the body prototype by layout only: plain, inherit or link creature', () => {
    expect(templateFor({ cardType: 'creature', colors: ['P'] })).toBe('CRIATURA - PROTOTIPO');
    expect(templateFor({ cardType: 'creature', colors: ['W'] })).toBe('CRIATURA - PROTOTIPO');
    expect(templateFor({ cardType: 'creature', enlace: true })).toBe('CRIATURA ENLACE - PROTOTIPO');
    expect(templateFor({ cardType: 'creature', inheritEffects: [{}] })).toBe(
      'CRIATURA HER - PROTOTIPO',
    );
    expect(templateFor({ cardType: 'utility', colors: ['W'] })).toBe('CRIATURA - PROTOTIPO');
    expect(
      templateFor({ cardType: 'structure', inheritKeywordEffects: [{ keyword: 'Furia' }] }),
    ).toBe('CRIATURA HER - PROTOTIPO');
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
      '#441eea',
      '#ebf3f3',
    ]);
    const margin = rolePaint('margin', ['P', 'W']);
    expect(typeof margin === 'object' && margin?.gradient.stops.map((s) => s.color)).toEqual([
      '#835aff',
      '#ebf3f3',
    ]);
    const flipped = rolePaint('primary', ['W', 'P']);
    expect(typeof flipped === 'object' && flipped?.gradient.stops.map((s) => s.color)).toEqual([
      '#ebf3f3',
      '#441eea',
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

  it('tells on which side of a white two-color bar a text sits', () => {
    const bar = [0, 0, 1000, 40];
    // Blend band: 400..600.
    expect(sideOf([650, 700], bar, false)).toBe('white');
    expect(sideOf([650, 700], bar, true)).toBe('color');
    expect(sideOf([300, 700], bar, false)).toBe('both');
    expect(sideOf([100, 390], bar, true)).toBe('white');
  });

  it('compresses a name longer than its room horizontally only, keeping its center', () => {
    // 10 units of measure per character at size 10.
    const measure = (text: string) => text.length * 10;
    const node = (text: string) =>
      ({
        name: 'NAME',
        visible: true,
        bbox: [0, 0, 0, 0],
        text: {
          text,
          justify: 'center',
          transform: [1, 0, 0, 1, 100, 50],
          box: [0, 0, 200, 20],
          runs: [{ text, size: 10 }],
        },
      }) as never;
    const short = node('abcd');
    squeezeToFit(short, 150, measure);
    expect((short as { text: { transform: number[] } }).text.transform).toEqual([1, 0, 0, 1, 100, 50]);
    const long = node('abcdefghijklmnop');
    squeezeToFit(long, 150, measure);
    const [a, b] = textSpan(long, measure);
    expect((a + b) / 2).toBeCloseTo(200);
    expect(b - a).toBeCloseTo(100);
    expect((long as { text: { transform: number[] } }).text.transform[3]).toBe(1);
  });
});
