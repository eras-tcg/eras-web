import { blankMeta } from '@data/cards/meta-rules';
import {
  applyCode,
  cardColorsOf,
  classMatches,
  defaultSummonKind,
  columnRun,
  fitArt,
  parseSlotCode,
  regionBox,
  readDesign,
  swapCardColors,
  toggleCardColor,
  withCardType,
  withLink,
  withoutInherit,
} from './card-editor-rules';

describe('card-editor-rules', () => {
  it('keeps link frames on creatures only', () => {
    const f = { ...blankMeta('E1'), inheritEffects: [{} as never] };
    const link = withLink({ ...f, cardType: 'utility' }, true);
    expect([link.cardType, link.enlace, link.inheritEffects.length]).toEqual(['creature', true, 0]);
    const util = withCardType({ ...link, arrows: ['left'] }, 'utility');
    expect([util.enlace, util.arrows]).toEqual([false, []]);
    expect(withCardType(link, 'creature').enlace).toBe(true);
    expect(withLink(link, false).enlace).toBe(false);
    expect(withoutInherit(f).inheritEffects).toEqual([]);
  });

  it('always keeps one color', () => {
    const f = { ...blankMeta(''), colors: ['W'] };
    expect(toggleCardColor(f, 'W')).toBe(f);
    const two = toggleCardColor(f, 'R');
    expect([two.colors, two.colorIdentity]).toEqual([['W', 'R'], 'W']);
    expect(swapCardColors(two).colorIdentity).toBe('R');
    expect(cardColorsOf({ ...blankMeta(''), colorIdentity: 'B' })).toEqual(['B']);
    expect(cardColorsOf({ ...blankMeta(''), colorIdentity: '' })).toEqual(['W']);
  });

  it('reads a typed code', () => {
    const f = applyCode(blankMeta(''), ' e1.1-b15 ');
    expect([f.edition, f.colorIdentity, f.cardNumber]).toEqual(['E1.1', 'B', 15]);
    expect(applyCode(f, 'nada')).toBe(f);
  });

  it('suggests known classes, accents ignored, prefix first', () => {
    const known = ['ángel caído', 'caballero', 'ángel', 'dragón'];
    expect(classMatches('ang', known, [])).toEqual(['ángel', 'ángel caído']);
    expect(classMatches('ang', known, ['ángel'])).toEqual(['ángel caído']);
    expect(classMatches('ca', known, [])).toEqual(['caballero', 'ángel caído']);
    expect(classMatches(' ', known, [])).toEqual([]);
  });

  it('picks the usual special summon of the first color', () => {
    expect(defaultSummonKind({ ...blankMeta(''), colors: ['R'] })).toBe('promotion');
    expect(defaultSummonKind({ ...blankMeta(''), colors: ['G', 'B'] })).toBe('evolution');
    expect(defaultSummonKind({ ...blankMeta(''), colors: [], colorIdentity: 'W' })).toBe(
      'materialization',
    );
  });

  it('reads a saved design with defaults', () => {
    expect(readDesign(null)).toEqual({
      frameStyle: 'standard',
      goldBorder: false,
      her: false,
      noCost: false,
      noStrength: false,
      art: null,
    });
    const d = readDesign({ frameStyle: 'full', goldBorder: true, art: { scale: 1.5, x: 'a' } });
    expect([d.frameStyle, d.goldBorder, d.art]).toEqual(['full', true, { scale: 1.5, x: 0, y: 0 }]);
    expect(readDesign({ frameStyle: 'raro' }).frameStyle).toBe('standard');
  });

  it('finds the box of the region a flood fill reaches', () => {
    // 6 x 4: a 3 x 2 block of "art" at (1,1), a lone art pixel at (5,3) apart from it
    const w = 6;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    const paint = (x: number, y: number) => data.set([255, 0, 255, 255], (y * w + x) * 4);
    for (const [x, y] of [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [5, 3]]) paint(x, y);
    const magenta = (r: number, g: number, b: number) => r > 200 && g < 60 && b > 200;
    expect(regionBox(data, w, h, [2, 1], magenta)).toEqual([1, 1, 4, 3]);
    expect(regionBox(data, w, h, [0, 0], magenta)).toBeNull();
    expect(columnRun(data, w, h, [2, 1], magenta)).toEqual([1, 3]);
  });

  it('fits an art to cover a window, centered on it', () => {
    // A square art covers the card (744 x 1039) at zoom 1 with side 1039
    const whole = fitArt({ width: 1000, height: 1000 }, [0, 0, 744, 1039]);
    expect(whole).toEqual({ scale: 1, x: 0, y: 0 });
    const win = fitArt({ width: 1000, height: 1000 }, [24, 24, 720, 560]);
    expect(win.scale).toBeCloseTo(696 / 1039);
    expect([win.x, win.y]).toEqual([0, 292 - 519.5]);
  });

  it('reads a slot code', () => {
    expect(parseSlotCode('ST2-G05')).toEqual({ edition: 'ST2', color: 'G', number: 5 });
    expect(parseSlotCode('e1.1-b12')).toEqual({ edition: 'E1.1', color: 'B', number: 12 });
    expect(parseSlotCode('ST2')).toBeNull();
  });
});
