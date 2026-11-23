/**
 * The gem dust behind the screens (AmbientBackdropComponent): gold pentagons and blue motes that fall in a spiral
 * into the centre of the card back's vortex, faster the closer they are, and fade out as they reach it. Pure: the
 * component draws what these functions compute.
 */
export interface Mote {
  /** Distance to the vortex's centre and angle around it. */
  radius: number;
  angle: number;
  /** A gold pentagon (true) or a blue mote. */
  gem: boolean;
  size: number;
  spin: number;
  spinSpeed: number;
  alpha: number;
  /** 0 → 1 over its first seconds (fades in). */
  age: number;
  twinkle: number;
}

/** Below this distance to the centre a mote is gone (and a new one comes in from the edge). */
export const MOTE_GONE = 18;
/** The orbits are flattened a little, as the vortex seen at a slant. */
export const ORBIT_SQUASH = 0.82;

/** How many motes for a screen of this size: fewer on small screens, never more than 90. */
export function moteCount(width: number, height: number): number {
  return Math.round(Math.min(90, (width * height) / 16000));
}

/** A new mote: anywhere (the first screenful) or coming in from the edge (`maxRadius`). */
export function spawnMote(maxRadius: number, anywhere: boolean, random: () => number = Math.random): Mote {
  const gem = random() < 0.35;
  return {
    radius: anywhere ? 40 + random() * maxRadius : maxRadius * (0.8 + random() * 0.25),
    angle: random() * Math.PI * 2,
    gem,
    size: gem ? 2.2 + random() * 2.8 : 0.8 + random() * 1.2,
    spin: random() * Math.PI * 2,
    spinSpeed: (random() - 0.5) * 2,
    alpha: 0.35 + random() * 0.5,
    age: anywhere ? 1 : 0,
    twinkle: random() * Math.PI * 2,
  };
}

/** Moves a mote `dt` seconds along its spiral; false once it has reached the centre. */
export function stepMote(mote: Mote, dt: number): boolean {
  const near = Math.max(mote.radius, 30);
  // The vortex turns counter-clockwise: the angle goes down
  mote.angle -= (0.02 + 26 / near) * dt * 0.6;
  mote.radius -= (4 + 900 / near) * dt;
  mote.spin += mote.spinSpeed * dt;
  mote.twinkle += dt * 2.4;
  mote.age = Math.min(1, mote.age + dt / 2);
  return mote.radius >= MOTE_GONE;
}

/** How visible a mote is now: fades in when born, out near the centre, and twinkles a little. */
export function moteOpacity(mote: Mote): number {
  const nearCentre = Math.min(1, Math.max(0, (mote.radius - MOTE_GONE) / 140));
  return mote.alpha * nearCentre * mote.age * (0.75 + 0.25 * Math.sin(mote.twinkle));
}
