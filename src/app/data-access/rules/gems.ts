/** Gem (resource) rules, for the "Aprender a jugar" simulator. Same behaviour as the legacy page. */

export const MAX_COUNTER = 5;

export interface GemState {
  playerGems: number;
  rivalGems: number;
  playerCounter: number;
  rivalCounter: number;
  /** Spent so far this turn. */
  spent: number;
}

/** Turn 3 of the first player: both sides at 3. */
export const INITIAL_GEMS: GemState = { playerGems: 3, rivalGems: 3, playerCounter: 3, rivalCounter: 3, spent: 0 };

/** You can spend up to your gems plus the rival's. */
export const spendLimit = (s: GemState) => s.playerGems + s.rivalGems - s.spent;

/** Gems you would have left (negative = taken from the rival). */
export const remaining = (s: GemState) => s.playerGems - s.spent;

/** Over-spending blocks your attacks and goes to the rival next turn. */
export const excess = (s: GemState) => Math.max(0, s.spent - s.playerGems);

export function spend(s: GemState, amount: number): { state: GemState; error: string | null } {
  const n = Math.trunc(amount);
  if (!(n > 0)) return { state: s, error: null };
  if (n > spendLimit(s)) return { state: s, error: `Solo puedes gastar ${spendLimit(s)} gemas más (tus gemas + las del rival).` };
  return { state: { ...s, spent: s.spent + n }, error: null };
}

/** Ends your turn: the rival's counter grows and they get it plus your excess; then your counter grows. */
export function nextTurn(s: GemState): { state: GemState; message: string } {
  const extra = excess(s);
  const rivalCounter = Math.min(s.rivalCounter + 1, MAX_COUNTER);
  const playerCounter = Math.min(s.playerCounter + 1, MAX_COUNTER);
  return {
    state: { playerGems: playerCounter, rivalGems: s.rivalGems + extra + rivalCounter, playerCounter, rivalCounter, spent: 0 },
    message: extra > 0 ? `Gastaste de más y le diste ${extra} gemas al rival.` : 'Turno normal, sin penalización.',
  };
}

export type SlotState = 'available' | 'spent' | 'excess' | 'zero' | 'empty';

export interface GemSlot {
  value: number;
  /** Left half (your gems) or right half (excess taken from the rival). */
  side: 'player' | 'rival' | 'center';
  state: SlotState;
}

/** The 21-slot gem track: 10…1 for you, 0 in the middle, 1…10 for the excess. */
export function gemTrack(s: GemState): GemSlot[] {
  const left: GemSlot[] = Array.from({ length: 10 }, (_, i) => {
    const value = 10 - i;
    // Your gems fill from the middle outwards; spending empties them from the outermost one
    const state: SlotState = value > s.playerGems ? 'empty' : s.playerGems - value + 1 <= s.spent ? 'spent' : 'available';
    return { value, side: 'player', state };
  });
  const over = excess(s);
  const right: GemSlot[] = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, side: 'rival', state: i + 1 <= over ? 'excess' : 'empty' }));
  return [...left, { value: 0, side: 'center', state: 'zero' }, ...right];
}
