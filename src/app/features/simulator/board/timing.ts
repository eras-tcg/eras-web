import { HAND_REVEAL_MS } from '@data/simulator/game-notices';

/**
 * How long the board's animations last, in milliseconds: the one place to change them. The styles get them as custom
 * properties (`timingVars`, set on the board), so a CSS animation and the code waiting for it never drift apart.
 */
export const TIMING = {
  /** A field card exhausted: its place widens first, then it turns sideways into it. */
  tapWiden: 140,
  tapTurn: 300,
  tap: 440,
  /** The attacker striking what it hits. */
  charge: 800,
  /** An arrow (an attack's target, an effect's targets) drawing itself, holding and fading. */
  arrow: 950,
  /** A sign over a card (sword, shield) or an activation's aura. */
  badge: 1100,
  /** "+2" / "−1" rising from a card or the gems. */
  float: 1100,
  /** A destroyed card breaking where it lies. */
  shatter: 420,
  /** Cards flying between zones; a draw, one card after another; a card changing line; a summon and its burst. */
  flight: 650,
  draw: 550,
  drawStagger: 120,
  move: 520,
  summon: 600,
  burst: 750,
  /** The life lost turning face up on its pile. */
  lifeFlip: 320,
  /** A deck shuffled: it shakes. */
  shuffle: 600,
  /** After an attack is declared, a moment before the block; after cards are destroyed, before the field settles. */
  beforeBlock: 650,
  beforeSettle: 450,
  /** A clash or direct damage shown big. */
  combatReveal: 2600,
  /** A chain link joining or resolving shown big; the chain starting to resolve. */
  chainShow: 2100,
  chainResolution: 1500,
  /** The players face to face at the start. */
  matchStart: 2800,
  /** A card revealed from a hand. */
  handReveal: HAND_REVEAL_MS,
} as const;

/** The timings the styles use, as custom properties of the board ("--sim-tap-turn: 300ms"…). */
export function timingVars(): Record<string, string> {
  return {
    '--sim-tap-widen': `${TIMING.tapWiden}ms`,
    '--sim-tap-turn': `${TIMING.tapTurn}ms`,
    '--sim-combat-reveal': `${TIMING.combatReveal}ms`,
    '--sim-chain-show': `${TIMING.chainShow}ms`,
    '--sim-chain-resolution': `${TIMING.chainResolution}ms`,
    '--sim-match-start': `${TIMING.matchStart}ms`,
    '--sim-hand-reveal': `${TIMING.handReveal}ms`,
  };
}

/** The board's layers over the table (tokens `--z-sim-*`), for the elements its code creates. */
export const LAYER = {
  parkedLife: 'var(--z-sim-parked)',
  /** A field card gliding to its new line, over its neighbors. */
  raised: 'var(--z-sim-raised)',
  spotlight: 'var(--z-sim-spotlight)',
  charge: 'var(--z-sim-charge)',
  fx: 'var(--z-sim-fx)',
  float: 'var(--z-sim-float)',
  pileUnder: 'var(--z-sim-pile-under)',
  flight: 'var(--z-sim-flight)',
  shatter: 'var(--z-sim-shatter)',
} as const;
