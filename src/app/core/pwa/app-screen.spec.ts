import { TestBed } from '@angular/core/testing';
import { APP_MODE } from '../server/server-access';
import { detectAppMode, isInstalledApp } from './app-mode';
import { AppScreen, needsFullscreenRequest, nextLayoutBox, showFullscreenToggle } from './app-screen';

const win = (modes: string[], standalone?: boolean) =>
  ({ matchMedia: (q: string) => ({ matches: modes.some((m) => q.includes(m)) }), navigator: { standalone } }) as unknown as Window;

describe('the installed app', () => {
  it('is display-mode standalone or fullscreen, or an iPhone home screen app; not minimal-ui nor a tab', () => {
    expect(isInstalledApp(win([]))).toBe(false);
    expect(isInstalledApp(win(['display-mode: standalone']))).toBe(true);
    expect(isInstalledApp(win(['display-mode: fullscreen']))).toBe(true);
    expect(isInstalledApp(win(['display-mode: minimal-ui']))).toBe(false);
    expect(isInstalledApp(win([], true))).toBe(true);
    expect(detectAppMode(win(['display-mode: standalone']))).toBe('app');
    expect(detectAppMode(win([]))).toBe('browser');
  });

  it('asks for full screen on a tap only where it is allowed and not full screen yet', () => {
    const base = { installed: true, touch: true, fullscreenEnabled: true, elementFullscreen: false };
    expect(needsFullscreenRequest(base)).toBe(true);
    expect(needsFullscreenRequest({ ...base, installed: false })).toBe(false);
    // A desktop's installed window is left as the player sizes it
    expect(needsFullscreenRequest({ ...base, touch: false })).toBe(false);
    expect(needsFullscreenRequest({ ...base, fullscreenEnabled: false })).toBe(false);
    expect(needsFullscreenRequest({ ...base, elementFullscreen: true })).toBe(false);
    // Opened as "fullscreen" from the manifest it still asks (some phones keep the bars there): only the page's own
    // full screen counts as done
  });

  it('has no "Pantalla completa" button on a phone or tablet (the browser and a desktop window keep it)', () => {
    expect(showFullscreenToggle({ mode: 'app', touch: true })).toBe(false);
    expect(showFullscreenToggle({ mode: 'app', touch: false })).toBe(true);
    expect(showFullscreenToggle({ mode: 'browser', touch: true })).toBe(true);
    expect(showFullscreenToggle({ mode: 'browser', touch: false })).toBe(true);
  });
});

describe('nextLayoutBox', () => {
  const touch = { touch: true };
  it('on a touch screen the bars shown for a moment (top, bottom or a side) and the keyboard never shrink it', () => {
    const start = nextLayoutBox(null, { width: 844, height: 390 }, touch);
    expect(start).toEqual({ width: 844, height: 390 });
    expect(nextLayoutBox(start, { width: 844, height: 342 }, touch)).toEqual(start);
    // The navigation buttons on a side, in landscape: the width stays too
    expect(nextLayoutBox(start, { width: 796, height: 390 }, touch)).toEqual(start);
    // The bars went away (full screen): it grows
    expect(nextLayoutBox(start, { width: 892, height: 412 }, touch)).toEqual({ width: 892, height: 412 });
  });

  it('turning the phone takes the new size', () => {
    expect(nextLayoutBox({ width: 844, height: 390 }, { width: 390, height: 844 }, touch)).toEqual({ width: 390, height: 844 });
  });

  it('a desktop window follows its size', () => {
    expect(nextLayoutBox({ width: 1200, height: 800 }, { width: 1200, height: 600 }, { touch: false })).toEqual({ width: 1200, height: 600 });
  });
});

describe('AppScreen', () => {
  afterEach(() => {
    document.documentElement.classList.remove('eras-app');
    document.documentElement.style.removeProperty('--app-height');
    vi.useRealTimers();
  });

  function screen(mode: 'app' | 'browser') {
    TestBed.configureTestingModule({ providers: [{ provide: APP_MODE, useValue: mode }] });
    return TestBed.inject(AppScreen);
  }

  it('does nothing in the browser', () => {
    screen('browser').start();
    expect(document.documentElement.classList.contains('eras-app')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('');
  });

  it('installed: marks the page, fixes the layout height and locks landscape', () => {
    const lock = vi.fn(() => Promise.resolve());
    Object.defineProperty(window.screen, 'orientation', { configurable: true, value: { lock } });
    window.innerHeight = 390;
    window.innerWidth = 844;
    screen('app').start();
    expect(document.documentElement.classList.contains('eras-app')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('390px');
    expect(lock).toHaveBeenCalledWith('landscape');
  });

  it('installed on a touch screen: the system bars shown for a moment do not shrink the layout', () => {
    vi.useFakeTimers();
    const matchMedia = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes('pointer: coarse'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
    try {
      window.innerHeight = 390;
      window.innerWidth = 844;
      screen('app').start();
      window.innerHeight = 342;
      window.dispatchEvent(new Event('resize'));
      expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('390px');
      // The navigation buttons on a side: nor the width
      window.innerHeight = 390;
      window.innerWidth = 796;
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(document.documentElement.style.getPropertyValue('--app-width')).toBe('844px');
      // Turned: the new size
      window.innerHeight = 844;
      window.innerWidth = 390;
      window.dispatchEvent(new Event('resize'));
      expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('844px');
    } finally {
      window.matchMedia = matchMedia;
    }
  });
});
