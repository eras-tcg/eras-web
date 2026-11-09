/** A screen the "back" button leads to. */
export interface ScreenLink {
  route: string;
  label: string;
}

const HOME: ScreenLink = { route: '/home', label: 'Inicio' };
const PLAY: ScreenLink = { route: '/play', label: 'Jugar' };
const SOCIAL: ScreenLink = { route: '/social', label: 'Social' };
const EDITIONS: ScreenLink = { route: '/editions', label: 'Tienda' };
const MY_DECKS: ScreenLink = { route: '/my-decks', label: 'Mazos' };
const ADMIN: ScreenLink = { route: '/admin', label: 'Administración' };
const PROFILE: ScreenLink = { route: '/profile', label: 'Mi perfil' };

/** Administration's tools (not /admin itself, which hangs from the home). */
const ADMIN_SCREENS = /^\/(?:users-manager|activity-log|roles|permissions|updates-manager|card-ref|games-manager|card-meta)$/;

/**
 * Where each screen sits in the hub's tree (there is no navigation bar: every screen goes back to its parent).
 * First match wins; a path that matches nothing hangs from the home.
 */
const PARENTS: [RegExp, ScreenLink | null][] = [
  [/^\/home$/, null],
  [/^\/(?:login|validate)$/, null],
  [/^\/(?:simulator(?:\/[^/]+)?|ruling)$/, PLAY],
  [/^\/(?:public-decks|tierlist)$/, SOCIAL],
  [/^\/(?:booster-result|editions\/[^/]+)$/, EDITIONS],
  [/^\/(?:deck\/[^/]+|deck-builder)$/, MY_DECKS],
  [ADMIN_SCREENS, ADMIN],
  [/^\/profile\/history$/, PROFILE],
];

/** Path of a router URL, without query or fragment. */
function pathOf(url: string): string {
  return url.split(/[?#]/)[0].replace(/\/+$/, '') || '/home';
}

/** The screen "back" leads to from `url`; null on the home (and outside the session). */
export function parentScreen(url: string): ScreenLink | null {
  const path = pathOf(url);
  for (const [pattern, parent] of PARENTS) if (pattern.test(path)) return parent;
  return HOME;
}

/** Administration and its tools: a space apart from the game, without the game's quick buttons. */
export function isAdminScreen(url: string): boolean {
  const path = pathOf(url);
  return path === ADMIN.route || ADMIN_SCREENS.test(path);
}

/** How deep `url` is in the hub's tree: the home is 0, its menu entries 1, and so on. */
export function screenDepth(url: string): number {
  let depth = 0;
  for (let parent = parentScreen(url); parent && depth < 10; parent = parentScreen(parent.route)) depth++;
  return depth;
}

export type NavDirection = 'forward' | 'back' | 'same';

/** Going deeper slides the new screen in from the right; going up, from the left. */
export function navDirection(from: string, to: string): NavDirection {
  const a = screenDepth(from);
  const b = screenDepth(to);
  return b > a ? 'forward' : b < a ? 'back' : 'same';
}
