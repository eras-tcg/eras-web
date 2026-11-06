import { RankProgressView, RankTier } from '@core/ranks/rank-tier';

export { RANK_DIVISIONS, RANK_LABELS, rankChangeText, rankDetail, rankDivision, rankTitle } from '@core/ranks/rank-tier';
export type { RankTier } from '@core/ranks/rank-tier';

/** A player's place in the ladder, as the server sends it (never their hidden strength). */
export interface RankStanding extends RankProgressView {
  games: number;
  wins: number;
  losses: number;
  /** The highest tier reached. */
  peak: RankTier;
}

/** What a ranked game changed. */
export interface RankChange {
  matchId: string;
  roomId: string;
  at: string;
  before: RankStanding;
  after: RankStanding;
  /** Said to the player: "+1 gema", "¡Asciendes a Plata!", … */
  summary: string;
  promoted: boolean;
  demoted: boolean;
}

/** A player on the Retador board: their place (1: the most points), name, icon and points. */
export interface ChallengerRow {
  place: number;
  userId: string;
  username: string | null;
  avatar: string | null;
  points: number;
}

export interface MyRank extends RankStanding {
  lastChange: RankChange | null;
}
