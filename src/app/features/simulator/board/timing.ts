import { HAND_REVEAL_MS } from '@data/simulator/game-notices';

/**
 * How long the board's animations last at normal speed, in milliseconds: the one place to change them. Read them through
 * TIMING (scaled by the player's speed). The styles get them as custom properties (`timingVars`, set on the board), so a
 * CSS animation and the code waiting for it never drift apart.
 */
const BASE = {
  /** A field card exhausted: its place widens first, then it turns sideways into it. */
  tapWiden: 140,
  tapTurn: 300,
  tap: 440,
  /** The attacker striking what it hits. */
  charge: 1000,
  /** An arrow (an attack's target, an effect's targets) drawing itself, holding and fading. */
  arrow: 950,
  /** A sign over a card (sword, shield). */
  badge: 1100,
  /** An effect activated on its card: it glows and motes of light rise from it. */
  activation: 1300,
  /**
   * The special summons, each its own (special-summon-fx), and how long before the card lands each starts: by ritual a
   * circle of runes; Ascenso a rank's insignia over a pillar of light; Materialización matter drawn in to compose it;
   * Evolución strands of life coiling round it.
   */
  ritual: 1300,
  ritualLead: 0,
  promotion: 1500,
  promotionLead: 0,
  materialization: 1500,
  materializationLead: 650,
  evolution: 1400,
  evolutionLead: 0,
  /** "+2" / "−1" rising from a card or the gems. */
  float: 1100,
  /** A destroyed card breaking where it lies. */
  shatter: 700,
  /** Cards flying between zones; a draw, one card after another; a card changing line; a summon and its burst. */
  flight: 650,
  draw: 500,
  drawStagger: 120,
  /** A card drawn, held over its place in the hand (while the hand makes room) and then set down into it. */
  drawHold: 220,
  drawDown: 220,
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
  /** The turn or the phase changing, shown big across the table. */
  phaseShow: 1700,
  /** The players face to face at the start. */
  matchStart: 2800,
  /** A card revealed from a hand. */
  handReveal: HAND_REVEAL_MS,
} as const;

/**
 * "Velocidad de las animaciones", slowest to fastest: how much faster than normal they play (×2: in half the time).
 * BoardPreferences keeps the step; BoardAnimations sets the durations' factor here (1 / the speed).
 */
export const ANIMATION_SPEEDS = [0.5, 0.75, 1, 1.5, 2] as const;

let pace = 1;

/** Every board animation from now on lasts `factor` times its normal length (1 normal, under 1 faster). */
export function setAnimationPace(factor: number): void {
  pace = factor;
}

export function animationPace(): number {
  return pace;
}

/** The board's durations at the player's speed (each read gives the current one). */
export const TIMING = Object.defineProperties(
  {},
  Object.fromEntries(Object.keys(BASE).map((k) => [k, { enumerable: true, get: () => BASE[k as keyof typeof BASE] * pace }])),
) as { readonly [K in keyof typeof BASE]: number };

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

/**
 * The timings the styles use at speed `factor`, as custom properties of the board ("--sim-tap-turn: 300ms"…), and the
 * factor itself (--sim-pace) for the styles' own durations.
 */
export function timingVars(factor = pace): Record<string, string> {
  const ms = (k: keyof typeof BASE) => `${BASE[k] * factor}ms`;
  return {
    '--sim-pace': `${factor}`,
    '--sim-tap-widen': ms('tapWiden'),
    '--sim-tap-turn': ms('tapTurn'),
    '--sim-combat-reveal': ms('combatReveal'),
    '--sim-phase-show': ms('phaseShow'),
    '--sim-chain-show': ms('chainShow'),
    '--sim-chain-resolution': ms('chainResolution'),
    '--sim-match-start': ms('matchStart'),
    '--sim-hand-reveal': ms('handReveal'),
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
