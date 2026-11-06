import { RankStanding, rankChangeText, rankDetail, rankTitle } from './rank.model';

const standing = (over: Partial<RankStanding> = {}): RankStanding => ({
  tier: 'IRON',
  gems: 1,
  maxGems: 3,
  shields: 0,
  inSeries: false,
  seriesWins: 0,
  seriesLosses: 0,
  points: 0,
  games: 10,
  wins: 6,
  losses: 4,
  peak: 'IRON',
  ...over,
});

describe('a rank in words', () => {
  it('the league with its division: one per gem, from 1', () => {
    expect(rankTitle(standing({ gems: 0 }))).toBe('Hierro 1');
    expect(rankTitle(standing({ gems: 1 }))).toBe('Hierro 2');
    expect(rankTitle(standing({ gems: 2 }))).toBe('Hierro 3');
    expect(rankTitle(standing({ tier: 'GOLD', gems: 3, maxGems: 4 }))).toBe('Oro 4');
    expect(rankDetail(standing())).toBeNull();
  });

  it('a promotion series is the last division, and says how it goes', () => {
    const s = standing({ tier: 'PLATINUM', gems: 5, maxGems: 5, inSeries: true, seriesWins: 1 });
    expect(rankTitle(s)).toBe('Platino 5');
    expect(rankDetail(s)).toBe('Serie de ascenso 1-0');
  });

  it('Retador has no divisions: its points', () => {
    expect(rankTitle(standing({ tier: 'CHALLENGER', gems: 0, maxGems: 0, points: 35 }))).toBe('Retador');
    expect(rankDetail(standing({ tier: 'CHALLENGER', points: 1 }))).toBe('1 punto');
  });
});

describe('what a game did to the rank', () => {
  it('a league up or down', () => {
    expect(rankChangeText(standing({ gems: 2 }), standing({ tier: 'BRONZE', gems: 0 }), true, false)).toBe('¡Subes a Bronce!');
    expect(rankChangeText(standing({ tier: 'DIAMOND' }), standing({ tier: 'CHALLENGER', maxGems: 0 }), true, false)).toBe('¡Llegas a Retador!');
    expect(rankChangeText(standing({ tier: 'GOLD', maxGems: 4 }), standing({ tier: 'SILVER', gems: 3, maxGems: 4 }), false, true)).toBe('Bajas de Oro');
  });

  it('divisions, shields and series', () => {
    expect(rankChangeText(standing({ gems: 1 }), standing({ gems: 2 }), false, false)).toBe('+1 división');
    expect(rankChangeText(standing({ tier: 'SILVER', gems: 2, maxGems: 4 }), standing({ tier: 'SILVER', gems: 1, maxGems: 4 }), false, false)).toBe('−1 división');
    expect(rankChangeText(standing({ tier: 'SILVER', gems: 0, maxGems: 4, shields: 2 }), standing({ tier: 'SILVER', gems: 0, maxGems: 4, shields: 1 }), false, false)).toBe('Pierdes un escudo');
    expect(rankChangeText(standing({ gems: 0 }), standing({ gems: 0 }), false, false)).toBe('Tu rango se mantiene');
    const platinum = { tier: 'PLATINUM' as const, maxGems: 5 };
    expect(rankChangeText(standing({ ...platinum, gems: 4 }), standing({ ...platinum, gems: 5, inSeries: true }), false, false)).toBe('Serie de ascenso: gana 2 de 3');
    expect(rankChangeText(standing({ ...platinum, gems: 5, inSeries: true }), standing({ ...platinum, gems: 5, inSeries: true, seriesWins: 1 }), false, false)).toBe('Serie de ascenso 1-0');
    expect(rankChangeText(standing({ ...platinum, gems: 5, inSeries: true, seriesLosses: 1 }), standing({ ...platinum, gems: 3 }), false, false)).toBe('Serie perdida');
  });

  it('Retador: its points', () => {
    const challenger = { tier: 'CHALLENGER' as const, maxGems: 0 };
    expect(rankChangeText(standing({ ...challenger, points: 40 }), standing({ ...challenger, points: 58 }), false, false)).toBe('+18 puntos');
    expect(rankChangeText(standing({ ...challenger, points: 40 }), standing({ ...challenger, points: 39 }), false, false)).toBe('−1 punto');
  });
});
