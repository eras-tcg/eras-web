import { ZoneName } from '@data/simulator/simulator.model';
import { IconName } from '@ui/primitives/icon/icon.component';

/** A place a card can be sent to by hand ("Enviar a…"): the zone, the deck's end, face down for the lives. */
export interface SendDestination {
  id: string;
  zone: ZoneName;
  /** The deck's (or the lives') end it goes to. */
  position: 'top' | 'bottom' | null;
  faceDown: boolean;
  label: string;
  icon: IconName;
}

/** Every "Enviar a…" of the board, in this order, with these labels and icons. */
export const SEND_DESTINATIONS: readonly SendDestination[] = [
  { id: 'hand', zone: 'hand', position: null, faceDown: false, label: 'A la mano', icon: 'zone-hand' },
  { id: 'field', zone: 'field', position: null, faceDown: false, label: 'Al campo', icon: 'zone-front' },
  { id: 'tributeZone', zone: 'tributeZone', position: null, faceDown: false, label: 'A tributos', icon: 'zone-tribute' },
  { id: 'discardPile', zone: 'discardPile', position: null, faceDown: false, label: 'Al descarte', icon: 'zone-discard' },
  // Cards sent to the lives go face down, like when they are dealt
  { id: 'lifeStack', zone: 'lifeStack', position: 'top', faceDown: true, label: 'A las vidas (boca abajo)', icon: 'zone-life' },
  { id: 'deck-top', zone: 'deck', position: 'top', faceDown: false, label: 'Al tope del mazo', icon: 'zone-deck' },
  { id: 'deck-bottom', zone: 'deck', position: 'bottom', faceDown: false, label: 'Al fondo del mazo', icon: 'zone-deck' },
];

/** Where a card of `from` can be sent (null: from a Material or Recurso): every place but its own zone. */
export function sendDestinations(from: ZoneName | null): SendDestination[] {
  return SEND_DESTINATIONS.filter((d) => d.zone !== from);
}

/** The option id of a destination in the "Enviar a…" dialog, and back. */
export const destinationOptionId = (d: SendDestination) => `to:${d.id}`;
export function destinationOf(optionId: string): SendDestination | null {
  return optionId.startsWith('to:') ? (SEND_DESTINATIONS.find((d) => d.id === optionId.slice(3)) ?? null) : null;
}
