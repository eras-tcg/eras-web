/** The ranked ladder's tiers, low to high (Hierro … Retador). */
export type RankTier = 'IRON' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'CHALLENGER';

export const RANK_LABELS: Record<RankTier, string> = {
  IRON: 'Hierro',
  BRONZE: 'Bronce',
  SILVER: 'Plata',
  GOLD: 'Oro',
  PLATINUM: 'Platino',
  DIAMOND: 'Diamante',
  CHALLENGER: 'Retador',
};

/** Where a player stands inside their tier (what the emblem's progress shows). */
export interface RankProgressView {
  tier: RankTier;
  /** Gems of the tier filled, out of maxGems (Retador: none, points instead). */
  gems: number;
  maxGems: number;
  /** Plata and Oro: falls spared at no gems. */
  shields: number;
  /** Platino and Diamante, gems full: the promotion series (two wins of three). */
  inSeries: boolean;
  seriesWins: number;
  seriesLosses: number;
  /** Retador's points. */
  points: number;
}

/**
 * The rank's name with its division: each gem of the league is a division, from 1 ("Hierro 1") up to the last one
 * before going up ("Hierro 3"); in a promotion series, the last division. Retador has no divisions.
 */
export function rankTitle(s: RankProgressView): string {
  if (s.tier === 'CHALLENGER') return RANK_LABELS.CHALLENGER;
  return `${RANK_LABELS[s.tier]} ${rankDivision(s)}`;
}

/** The division inside the league, from 1 (0 for Retador, which has none). */
export function rankDivision(s: RankProgressView): number {
  if (s.tier === 'CHALLENGER') return 0;
  return s.inSeries ? s.maxGems : Math.min(s.gems + 1, s.maxGems);
}

/**
 * What a game did to the rank, said in divisions: "¡Subes a Bronce!", "Bajas de Oro", "+1 división", "Serie de ascenso 1-0",
 * "Pierdes un escudo", "+18 puntos"…
 */
export function rankChangeText(before: RankProgressView, after: RankProgressView, promoted: boolean, demoted: boolean): string {
  if (promoted) return after.tier === 'CHALLENGER' ? '¡Llegas a Retador!' : `¡Subes a ${RANK_LABELS[after.tier]}!`;
  if (demoted) return `Bajas de ${RANK_LABELS[before.tier]}`;
  if (after.tier === 'CHALLENGER') {
    const d = after.points - before.points;
    return `${d >= 0 ? '+' : '−'}${Math.abs(d)} ${Math.abs(d) === 1 ? 'punto' : 'puntos'}`;
  }
  if (after.inSeries && !before.inSeries) return 'Serie de ascenso: gana 2 de 3';
  if (after.inSeries) return `Serie de ascenso ${after.seriesWins}-${after.seriesLosses}`;
  if (before.inSeries) return 'Serie perdida';
  const d = rankDivision(after) - rankDivision(before);
  if (d) return `${d > 0 ? '+' : '−'}${Math.abs(d)} ${Math.abs(d) === 1 ? 'división' : 'divisiones'}`;
  if (after.shields < before.shields) return 'Pierdes un escudo';
  return 'Tu rango se mantiene';
}

/** What goes with the title, when anything: Retador's points or the promotion series ("Serie de ascenso 1-0"). */
export function rankDetail(s: RankProgressView): string | null {
  if (s.tier === 'CHALLENGER') return `${s.points} ${s.points === 1 ? 'punto' : 'puntos'}`;
  if (s.inSeries) return `Serie de ascenso ${s.seriesWins}-${s.seriesLosses}`;
  return null;
}

/** The leagues in order with their divisions (Retador: none, it goes by points). */
export const RANK_DIVISIONS: Record<RankTier, number> = {
  IRON: 3,
  BRONZE: 3,
  SILVER: 4,
  GOLD: 4,
  PLATINUM: 5,
  DIAMOND: 5,
  CHALLENGER: 0,
};
