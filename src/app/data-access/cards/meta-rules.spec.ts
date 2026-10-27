import { describe, expect, it } from 'vitest';
import { CardMeta, DriveCard } from './card.model';
import { assignImage, blankMeta, keywordToken, metaForImage, metaFormFor, metaWithoutImage, toMetaPayload, validateMeta } from './meta-rules';

const image = (over: Partial<DriveCard> = {}): DriveCard => ({
  id: 'img1',
  name: 'Eisten',
  edition: 'E1',
  sub_edition: '1',
  number: 7,
  color_identity: 'B',
  image_url: null,
  time_stamp: null,
  ...over,
});
const meta: CardMeta = {
  id: 'm1',
  cardName: 'eisten',
  cardType: 'creature',
  strength: 3,
  cost: 1,
  edition: 'ST1',
  subEdition: null,
  cardNumber: 1,
  colorIdentity: 'B',
  rarity: 'UC',
  effects: [{ instance: 'En Invocación', effectBlocks: [{ resolution: 'roba 1' }] }],
};

describe('metaForImage', () => {
  it('takes identity from the image and game data from a same-name printing', () => {
    const f = metaForImage(image(), [meta]);
    expect(f).toMatchObject({ cardName: 'Eisten', edition: 'E1.1', cardNumber: 7, colorIdentity: 'B', strength: 3, rarity: 'UC', colors: ['B'] });
    expect(f.effects).toEqual(meta.effects);
    expect(f.effects).not.toBe(meta.effects);
  });

  it('starts blank without a same-name printing', () => {
    expect(metaForImage(image({ name: 'Nuevo' }), [meta])).toMatchObject({ cardName: 'Nuevo', strength: null, effects: [] });
  });
});

describe('metaFormFor', () => {
  it('edits existing metadata with the edition of the image', () => {
    const f = metaFormFor({ ...image({ edition: 'ST1', sub_edition: '' }), meta });
    expect(f).toMatchObject({ cardName: 'eisten', edition: 'ST1', cost: 1, colors: ['B'] });
  });
});

describe('toMetaPayload / validateMeta', () => {
  it('splits sub-editions and sends empty text as null', () => {
    const p = toMetaPayload({ ...blankMeta('E1.2'), cardName: ' X ', regulation: ' ', keywordEffects: [{ keyword: null }, { keyword: 'Celeridad' }] });
    expect(p).toMatchObject({ cardName: 'X', edition: 'E1', subEdition: '2', regulation: null, colors: null });
    expect(p.keywordEffects).toEqual([{ keyword: 'Celeridad' }]);
    expect(toMetaPayload(blankMeta('ST1')).subEdition).toBeNull();
  });

  it('requires name and edition, and non-negative numbers', () => {
    expect(validateMeta(blankMeta())).toHaveLength(2);
    expect(validateMeta({ ...blankMeta('E1'), cardName: 'a', cost: -1 })).toEqual(['Coste debe ser un número positivo.']);
  });
});

describe('keywordToken', () => {
  it('adds the value only when given', () => {
    expect(keywordToken('Provocar {nivel}', 3)).toBe('[[Provocar {nivel}:3]]');
    expect(keywordToken('Celeridad', '')).toBe('[[Celeridad]]');
  });
});

describe('metaWithoutImage / assignImage', () => {
  it('lists metadata with no (or ambiguous) image and points it at a chosen one', () => {
    const images = [image({ edition: 'ST1', sub_edition: '', number: 1 }), image({ id: 'dup1', number: 9 }), image({ id: 'dup2', number: 9 })];
    const orphan: CardMeta = { ...meta, id: 'm2', edition: 'E1', subEdition: '1', cardNumber: 9 };
    expect(metaWithoutImage([meta, orphan], images).map((m) => m.id)).toEqual(['m2']);
    expect(assignImage(orphan, images[0])).toMatchObject({ edition: 'ST1', subEdition: null, cardNumber: 1, colorIdentity: 'B' });
  });
});
