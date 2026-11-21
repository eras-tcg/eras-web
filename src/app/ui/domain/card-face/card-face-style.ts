/**
 * A card drawn outside Angular (the board's animations build their cards as plain elements): the same corners and the
 * same back as eras-card-face. Spread over the element's style; its picture fills it, or its back when it has none.
 */
export function cardFaceStyle(imageUrl: string | null | undefined): Partial<CSSStyleDeclaration> {
  return {
    borderRadius: 'var(--radius-card)',
    background: imageUrl ? `center / cover no-repeat url("${imageUrl}")` : 'var(--color-card-back)',
  };
}
