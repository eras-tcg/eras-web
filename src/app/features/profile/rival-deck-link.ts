import { MatchDeckCard } from '@data/simulator/matches.api';

/** The deck a rival played in a game of the history, as the history keeps it. */
export interface RivalDeckData {
  rival: string;
  deckName?: string | null;
  cards: MatchDeckCard[];
}

/** What the match history hands the rival deck's view in the navigation's state. */
export interface RivalDeckState {
  rivalDeck: RivalDeckData;
}

/** The rival deck's view, opened from the match history (its "back" returns there). */
export const RIVAL_DECK_ROUTE = '/profile/history/rival-deck';
