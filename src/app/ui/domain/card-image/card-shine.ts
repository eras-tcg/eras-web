import { InjectionToken } from '@angular/core';

/**
 * Where a card shines, from its image's address: the card editor's render (`/api/cards/<id>/render?v=<key>`, also
 * shown by a Drive image redrawn in the editor) has its shine next to it (`/api/cards/<id>/shine`, a PNG drawn with it:
 * the glossy parts on top, the gold border below, white where it shines). Null for any other image. The render's
 * version goes along, so a new drawing is fetched again.
 */
export function shineUrlOf(imageUrl: string | null | undefined): string | null {
  const m = /^(.*\/api\/cards\/[^/?#]+)\/render(\?.*)?$/.exec(imageUrl ?? '');
  return m ? `${m[1]}/shine${m[2] ?? ''}` : null;
}

/** An image's address without its version (`?v=…`): the same picture under any version. */
export function imageKey(imageUrl: string | null | undefined): string {
  return (imageUrl ?? '').split(/[?#]/)[0];
}

/**
 * How the card pictures find their shine from their image's address (card-image, game-card): the app provides one that
 * knows the catalog (an image from R2 is the card's too); alone, only the editor's render address.
 */
export const CARD_SHINE = new InjectionToken<(imageUrl: string | null | undefined) => string | null>('card shine', {
  providedIn: 'root',
  factory: () => shineUrlOf,
});
