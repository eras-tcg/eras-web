import { SEND_DESTINATIONS, destinationOf, destinationOptionId, sendDestinations } from './send-destinations';

describe('send destinations', () => {
  it('leaves out the zone the card is in', () => {
    expect(sendDestinations('hand').map((d) => d.id)).toEqual(['field', 'tributeZone', 'discardPile', 'lifeStack', 'deck-top', 'deck-bottom']);
    expect(sendDestinations('deck').some((d) => d.zone === 'deck')).toBe(false);
    expect(sendDestinations(null)).toHaveLength(SEND_DESTINATIONS.length);
  });

  it('sends to the lives face down and to either end of the deck', () => {
    expect(destinationOf('to:lifeStack')).toMatchObject({ zone: 'lifeStack', faceDown: true });
    expect(destinationOf('to:deck-bottom')).toMatchObject({ zone: 'deck', position: 'bottom' });
    expect(destinationOf(destinationOptionId(SEND_DESTINATIONS[0]))).toBe(SEND_DESTINATIONS[0]);
    expect(destinationOf('flip')).toBeNull();
  });
});
