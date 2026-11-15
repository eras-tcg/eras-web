import { blankMeta } from '@data/cards/meta-rules';
import {
  applyCode,
  cardColorsOf,
  classMatches,
  defaultSummonKind,
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
});
