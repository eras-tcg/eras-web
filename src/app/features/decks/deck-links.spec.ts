import { deckBackLink, fromPublicDecks, fromTierlist } from './deck-links';

describe('deckBackLink', () => {
  it('goes back to the screen a deck was opened from, as it was left', () => {
    expect(deckBackLink(fromTierlist({ tab: 'e1' }))).toEqual({ route: '/tierlist', label: 'Tierlist', queryParams: { tab: 'e1' } });
    expect(deckBackLink(fromPublicDecks({ ed: 'E1' }))).toEqual({
      route: '/public-decks',
      label: 'Mazos públicos',
      queryParams: { ed: 'E1' },
    });
  });

  it('leaves the default (the player own decks) when opened from anywhere else', () => {
    expect(deckBackLink(null)).toBeUndefined();
    expect(deckBackLink({})).toBeUndefined();
    expect(deckBackLink({ from: 'somewhere' })).toBeUndefined();
  });
});
