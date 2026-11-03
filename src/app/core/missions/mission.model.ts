/** A mission as the server sends it: what it is, how far along, its target, its gems and whether it was claimed. */
export interface Mission {
  id: string;
  progress: number;
  target: number;
  gems: number;
  claimed: boolean;
}

/** The player's missions of today and of this week, and the days each set changes (YYYY-MM-DD). */
export interface MissionBoard {
  daily: Mission[];
  weekly: Mission[];
  nextDay: string;
  nextWeek: string;
}

export type MissionPeriod = 'daily' | 'weekly';
