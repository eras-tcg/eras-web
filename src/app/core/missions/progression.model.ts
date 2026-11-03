/** A step of the "Bienvenida" chain as the server sends it; `locked` until every step before it is claimed. */
export interface WelcomeStep {
  id: string;
  progress: number;
  target: number;
  gems: number;
  claimed: boolean;
  locked: boolean;
}

/** A milestone: tiers claimed of how many, and the next tier's target and gems (the last one's once `maxed`). */
export interface Milestone {
  id: string;
  tier: number;
  tiers: number;
  progress: number;
  target: number;
  gems: number;
  maxed: boolean;
}

/** The player's progression missions: done once per account, never reset. */
export interface ProgressionBoard {
  welcome: WelcomeStep[];
  milestones: Milestone[];
  badges: string[];
}
