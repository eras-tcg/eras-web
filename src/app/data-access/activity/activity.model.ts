/** What the activity log records (DriveManager ActivityLogService; LOGIN comes from UsersService). */
export type ActivityAction =
  | 'LOGIN'
  | 'VISIT'
  | 'SHOP_PURCHASE'
  | 'DECK_CREATE'
  | 'DECK_UPDATE'
  | 'DECK_DELETE'
  | 'ONLINE_GAME_START'
  | 'ONLINE_GAME_END'
  | 'SOLO_GAME_START'
  | 'SOLO_GAME_END';

/** One event of a player; username is the account's current name (missing once the account is deleted). */
export interface ActivityEntry {
  id: string;
  userId: string;
  username: string | null;
  action: ActivityAction;
  detail: Record<string, string | number>;
  at: string;
}

export interface ActivityPage {
  items: ActivityEntry[];
  total: number;
}

/** Filters of the log; from/to are ISO instants, both inclusive. */
export interface ActivityQuery {
  actions: ActivityAction[];
  user: string;
  from: string | null;
  to: string | null;
  page: number;
  size: number;
}
