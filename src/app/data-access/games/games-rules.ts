import { Deck } from '../decks/deck.model';
import { Game, GameNote, PlayerEntry, TierList, TierPage, TierRow } from './games.model';

export const emptyPlayer = (): PlayerEntry => ({ playerName: '', deckId: '', lives: [] });

export function emptyGame(previous?: Game): Game {
  // Players and decks are usually the same from one game to the next
  const keep = (p?: PlayerEntry) => ({ ...emptyPlayer(), playerName: p?.playerName ?? '', deckId: p?.deckId ?? '' });
  return { player1: keep(previous?.player1), player2: keep(previous?.player2), winner: 'player1', firstPlayer: 'player1', comment: '', duration: null };
}

/** "12:05" for 725 seconds; null without a duration. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export type TimelineItem = { type: 'game'; game: Game; at: string } | { type: 'note'; note: GameNote; at: string };

/** Games and notes together, newest first. */
export function timeline(games: readonly Game[], notes: readonly GameNote[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...games.map((game) => ({ type: 'game' as const, game, at: game.createdAt ?? '' })),
    ...notes.map((note) => ({ type: 'note' as const, note, at: note.createdAt ?? '' })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export interface StatsFilter {
  deckName: string;
  /** Text in the name of the player using the deck. */
  player: string;
  /** Text in the name of the opponent. */
  opponent: string;
  /** YYYY-MM-DD, inclusive. */
  from: string;
  to: string;
}

export const EMPTY_STATS_FILTER: StatsFilter = { deckName: '', player: '', opponent: '', from: '', to: '' };

export interface DeckStats {
  deck: Deck;
  played: number;
  won: number;
  /** 0..1 */
  ratio: number;
}

/** Games played and won per deck, counting both seats of every game. */
export function deckStats(games: readonly Game[], decks: readonly Deck[], f: StatsFilter): DeckStats[] {
  const player = f.player.trim().toLowerCase();
  const opponent = f.opponent.trim().toLowerCase();
  const byDeck = new Map<string, { played: number; won: number }>();
  for (const game of games) {
    const day = (game.createdAt ?? '').slice(0, 10);
    if ((f.from && day < f.from) || (f.to && day > f.to)) continue;
    for (const [side, other] of [
      ['player1', 'player2'],
      ['player2', 'player1'],
    ] as const) {
      const seat = game[side];
      if (!seat?.deckId) continue;
      if (player && !(seat.playerName ?? '').toLowerCase().includes(player)) continue;
      if (opponent && !(game[other]?.playerName ?? '').toLowerCase().includes(opponent)) continue;
      const s = byDeck.get(seat.deckId) ?? { played: 0, won: 0 };
      s.played++;
      if (game.winner === side) s.won++;
      byDeck.set(seat.deckId, s);
    }
  }
  const name = f.deckName.trim().toLowerCase();
  const rows = decks
    .filter((d) => !name || d.deckName.toLowerCase().includes(name))
    .map((deck) => {
      const s = byDeck.get(deck.id) ?? { played: 0, won: 0 };
      return { deck, ...s, ratio: s.played ? s.won / s.played : 0 };
    });
  // Filtering by player only makes sense for decks that played
  return player || opponent ? rows.filter((r) => r.played > 0) : rows;
}

// ── Tier list ───────────────────────────────────────────────────────────────

export const DEFAULT_TIERS = (): TierRow[] => [
  { label: 'S', color: '#FF7675', deckIds: [] },
  { label: 'A', color: '#FDCB6E', deckIds: [] },
  { label: 'B', color: '#55EFC4', deckIds: [] },
  { label: 'C', color: '#74B9FF', deckIds: [] },
  { label: 'D', color: '#B2BEC3', deckIds: [] },
];

/** Accepts the old single-page format ({ tiers }) and always returns at least one page. */
export function normalizeTierList(data: Partial<TierList> & { tiers?: TierRow[] }): TierList {
  const pages = data.pages?.length ? data.pages : data.tiers ? [{ id: '1', name: 'Principal', tiers: data.tiers }] : [];
  return { ...data, pages: pages.length ? pages : [{ id: '1', name: 'Principal', tiers: DEFAULT_TIERS() }] };
}

/** Moves a deck to another tier of the page (or out of the page when `to` is null). */
export function moveDeck(page: TierPage, deckId: string, to: string | null): TierPage {
  return {
    ...page,
    tiers: page.tiers.map((t) => {
      const without = t.deckIds.filter((id) => id !== deckId);
      return { ...t, deckIds: t.label === to ? [...without, deckId] : without };
    }),
  };
}

export function addDecks(page: TierPage, deckIds: readonly string[], to: string): TierPage {
  const placed = new Set(page.tiers.flatMap((t) => t.deckIds));
  const fresh = deckIds.filter((id) => !placed.has(id));
  return { ...page, tiers: page.tiers.map((t) => (t.label === to ? { ...t, deckIds: [...t.deckIds, ...fresh] } : t)) };
}
