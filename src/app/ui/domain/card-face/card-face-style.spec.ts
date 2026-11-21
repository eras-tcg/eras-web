import { cardFaceStyle } from './card-face-style';

describe('cardFaceStyle', () => {
  it('draws the picture with the card corners', () => {
    expect(cardFaceStyle('/a.jpg')).toEqual({
      borderRadius: 'var(--radius-card)',
      background: 'center / cover no-repeat url("/a.jpg")',
    });
  });

  it('draws the back without a picture', () => {
    expect(cardFaceStyle(null).background).toBe('var(--color-card-back)');
  });
});
