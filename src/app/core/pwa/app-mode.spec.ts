import { detectAppMode, isNativeApp } from './app-mode';

/** A window with these display modes and, optionally, Capacitor's bridge. */
const win = (native?: boolean, modes: string[] = []) =>
  ({
    matchMedia: (q: string) => ({ matches: modes.some((m) => q.includes(m)) }),
    navigator: {},
    ...(native === undefined ? {} : { Capacitor: { isNativePlatform: () => native } }),
  }) as unknown as Window;

describe('the Android app (Capacitor)', () => {
  it('is told by the bridge Capacitor puts on the page', () => {
    expect(isNativeApp(win(true))).toBe(true);
    expect(isNativeApp(win(false))).toBe(false);
    expect(isNativeApp(win())).toBe(false);
    expect(isNativeApp(undefined)).toBe(false);
    expect(isNativeApp({ Capacitor: { isNativePlatform: () => { throw new Error('x'); } } })).toBe(false);
  });

  it("is the installed app ('app': local-first, landscape, full screen), as the PWA's window", () => {
    expect(detectAppMode(win(true))).toBe('app');
    // Capacitor's web runtime in a browser tab is not native: the site as always
    expect(detectAppMode(win(false))).toBe('browser');
    expect(detectAppMode(win(undefined, ['display-mode: standalone']))).toBe('app');
    expect(detectAppMode(win())).toBe('browser');
  });
});
