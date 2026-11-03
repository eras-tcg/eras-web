/**
 * Gem rules for the "Cómo jugar" practice (rules v1.1, sections 4.0.8, 4.0.9, 5 and 8). Each player has a Marcador
 * (0–5, what they generate each turn); both share one Contador, a line from 10 on your side to 10 on the rival's:
 * gems one player gains, the other loses. Pure.
 */

export const MAX_MARKER = 5;
export const COUNTER_END = 10;

export type GemPlayer = 'you' | 'rival';

export interface GemGame {
  /** The shared Contador: positive on your side (your gems), negative on the rival's. */
  counter: number;
  markers: Record<GemPlayer, number>;
  /** Whose turn it is. */
  turn: GemPlayer;
}

const other = (p: GemPlayer): GemPlayer => (p === 'you' ? 'rival' : 'you');
const clamp = (n: number) => Math.max(-COUNTER_END, Math.min(COUNTER_END, n));
const toward = (p: GemPlayer) => (p === 'you' ? 1 : -1);

/** Gems a player has now (negative: they owe gems to the other one). */
export function gemsOf(g: GemGame, player: GemPlayer): number {
  return g.counter * toward(player);
}

/** Your third turn: both Marcadores at 3, and you just gained your 3 gems. */
export const PRACTICE_START: GemGame = { counter: 3, markers: { you: 3, rival: 3 }, turn: 'you' };

/**
 * The most the player whose turn it is can pay now (rule 5.0.0.1): paying may not leave the rival with more gems
 * than their Marcador shows.
 */
export function payLimit(g: GemGame): number {
  return Math.max(0, gemsOf(g, g.turn) + g.markers[other(g.turn)]);
}

/** Pays `amount` gems for the player whose turn it is: the Contador moves toward the rival. */
export function pay(g: GemGame, amount: number): { game: GemGame; error: string | null } {
  const n = Math.trunc(amount);
  if (!(n > 0)) return { game: g, error: null };
  const limit = payLimit(g);
  if (n > limit) return { game: g, error: `Solo puedes pagar ${limit} ${limit === 1 ? 'gema' : 'gemas'} más: el rival no puede quedar con más gemas que su Marcador.` };
  return { game: { ...g, counter: clamp(g.counter - n * toward(g.turn)) }, error: null };
}

/** A regular attack needs 0 or more gems (Furia is the exception). */
export function canAttack(g: GemGame): boolean {
  return gemsOf(g, g.turn) >= 0;
}

/**
 * Ends the turn (rule 8.3: unspent gems are lost, a debt stays) and starts the other player's (rule 8.1: their
 * Marcador goes up by 1, up to 5, and they gain that many gems).
 */
export function endTurn(g: GemGame): { game: GemGame; message: string } {
  const debt = Math.max(0, -gemsOf(g, g.turn));
  const counter = gemsOf(g, g.turn) > 0 ? 0 : g.counter;
  const next = other(g.turn);
  const marker = Math.min(MAX_MARKER, g.markers[next] + 1);
  const game: GemGame = { counter: clamp(counter + marker * toward(next)), markers: { ...g.markers, [next]: marker }, turn: next };
  const start = next === 'you' ? 'Empieza tu turno: tu' : 'Empieza el turno del rival: su';
  const total = gemsOf(game, next);
  const owed = debt > 0 ? ` (${marker} + ${debt} que se le debían)` : '';
  return { game, message: `${start} Marcador sube a ${marker} y arranca con ${total} ${total === 1 ? 'gema' : 'gemas'}${owed}.` };
}

export type CounterSlotState = 'you' | 'rival' | 'zero' | 'empty';

export interface CounterSlot {
  /** Its number on the line (10…1, 0, 1…10). */
  value: number;
  side: GemPlayer | 'center';
  state: CounterSlotState;
  /** Where the Contador's token stands. */
  current: boolean;
  /** The furthest the player whose turn it is may pay to (the rival's Marcador). */
  limit: boolean;
}

/** The 21 positions of the Contador: your 10…1 on the left, 0 in the middle, the rival's 1…10 on the right. */
export function counterTrack(g: GemGame): CounterSlot[] {
  const limitAt = -g.markers[other(g.turn)] * toward(g.turn);
  return Array.from({ length: 2 * COUNTER_END + 1 }, (_, i) => {
    const position = COUNTER_END - i; // +10 … −10
    const side: CounterSlot['side'] = position > 0 ? 'you' : position < 0 ? 'rival' : 'center';
    const filled = position !== 0 && Math.sign(position) === Math.sign(g.counter) && Math.abs(position) <= Math.abs(g.counter);
    return {
      value: Math.abs(position),
      side,
      state: position === 0 ? 'zero' : filled ? (position > 0 ? 'you' : 'rival') : 'empty',
      current: position === g.counter,
      limit: position === limitAt && limitAt !== 0,
    };
  });
}
