/**
 * Where the site runs: the browser's tab ('browser') or the installed app ('app': its own window, opened from the
 * home screen; display-mode standalone or fullscreen, or an iPhone home screen app). The installed app is local-first
 * (it does not wake the server until the player asks for something that needs it), always in landscape and full
 * screen; the browser's tab keeps the site as it always was.
 */
export type AppMode = 'browser' | 'app';

/** The installed app's window: display-mode standalone or fullscreen, or an iPhone home screen app (not minimal-ui). */
export function isInstalledApp(win: Pick<Window, 'matchMedia' | 'navigator'> | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win) return false;
  const media = (query: string) => win.matchMedia?.(query).matches === true;
  return media('(display-mode: standalone)') || media('(display-mode: fullscreen)') || (win.navigator as { standalone?: boolean }).standalone === true;
}

/** Decided once, when the site starts: a tab put in full screen later is still the browser. */
export function detectAppMode(win?: Pick<Window, 'matchMedia' | 'navigator'>): AppMode {
  return isInstalledApp(win) ? 'app' : 'browser';
}
