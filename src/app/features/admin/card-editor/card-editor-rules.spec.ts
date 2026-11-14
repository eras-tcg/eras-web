import { blankMeta } from '@data/cards/meta-rules';
import {
  applyCardKind,
  applyCode,
  cardKindOf,
  classMatches,
  defaultSummonKind,
  draftFromForm,
} from './card-editor-rules';

describe('card-editor-rules', () => {
  it('maps the seven card kinds to type, inherit frame and link', () => {
    const f = blankMeta('E1');
    const her = applyCardKind(f, 'utility-her');
    expect([her.form.cardType, her.form.enlace, her.her]).toEqual(['utility', false, true]);
    const link = applyCardKind(f, 'link');
    expect([link.form.cardType, link.form.enlace, link.her]).toEqual(['creature', true, false]);
    expect(cardKindOf(her.form, her.her)).toBe('utility-her');
    expect(cardKindOf(link.form, false)).toBe('link');
    expect(draftFromForm(her.form, true).her).toBe(true);
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
});
