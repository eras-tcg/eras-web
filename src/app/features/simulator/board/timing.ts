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
  charge: 1000,
  /** An arrow (an attack's target, an effect's targets) drawing itself, holding and fading. */
  arrow: 950,
  /** A sign over a card (sword, shield) or an activation's aura. */
  badge: 1100,
  /** "+2" / "−1" rising from a card or the gems. */
  float: 1100,
  /** A destroyed card breaking where it lies. */
  shatter: 860,
  /** Cards flying between zones; a draw, one card after another; a card changing line; a summon and its burst. */
  flight: 650,
  draw: 550,
  drawStagger: 120,
  /** A card drawn, held over its place in the hand (while the hand makes room) and then set down into it. */
  drawSettle: 300,
  move: 520,
  /** The cards of a row sliding to their new places when its order changes (a swap, a creature placed, the row closing up). */
  slide: 450,
  summon: 520,
  /** A summoned card hanging over its place before it drops: the weakest a moment, the strongest much longer. */
  summonHang: 40,
  summonHangStrong: 200,
  burst: 750,
  /** The life lost turning face up on its pile. */
  lifeFlip: 480,
  /** The cards around a summoned one hopping as it lands (each one's hop). */
  hop: 620,
  /** The table jolting under a blow (an attack landing, a card breaking, a summon landing). */
  quake: 380,
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

/** How heavy a card lands, 0 to 1: by its strength (2 or less the lightest, 12 or more the heaviest; none, light). */
export function impactWeight(strength: number | null): number {
  if (strength === null) return 0.25;
  return Math.min(1, Math.max(0, (strength - 2) / 10));
}

/** A summon by its weight: how long it hangs over its place, and its whole flight (its way there, the hang, the drop). */
export function summonTiming(weight: number): { hang: number; duration: number } {
  const hang = TIMING.summonHang + (TIMING.summonHangStrong - TIMING.summonHang) * weight;
  return { hang, duration: TIMING.summon + hang };
}

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
  /** Your turn's draw: under the sidebar and the game menu, over the rest of the board. */
  turnDraw: 'var(--z-sim-turn-draw)',
  /** A field card's place while its sprite animates in it: over its neighbours in the row (it does not move). */
  fieldLifted: 'var(--z-sim-field-lifted)',
  spotlight: 'var(--z-sim-spotlight)',
  charge: 'var(--z-sim-charge)',
  fx: 'var(--z-sim-fx)',
  float: 'var(--z-sim-float)',
  pileUnder: 'var(--z-sim-pile-under)',
  flight: 'var(--z-sim-flight)',
  shatter: 'var(--z-sim-shatter)',
} as const;
