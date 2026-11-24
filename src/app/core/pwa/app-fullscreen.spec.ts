import { TestBed } from '@angular/core/testing';
import { AppFullscreen } from './app-fullscreen';
import { AppScreen } from './app-screen';

type Win = Window & { erasDesktop?: unknown };

describe('AppFullscreen', () => {
  let calls: boolean[];
  let tell: ((on: boolean) => void) | null;

  function setUp(screen: Partial<AppScreen>): AppFullscreen {
    calls = [];
    tell = null;
    (window as Win).erasDesktop = {
      setFullScreen: (on: boolean) => calls.push(on),
      onFullScreenChange: (listener: (on: boolean) => void) => (tell = listener),
    };
    TestBed.configureTestingModule({ providers: [{ provide: AppScreen, useValue: { installed: true, fullscreenToggle: true, native: false, ...screen } }] });
    return TestBed.inject(AppFullscreen);
  }

  afterEach(() => {
    delete (window as Win).erasDesktop;
    localStorage.removeItem('eras-app-fullscreen');
  });

  it('opens the Windows app in full screen when the player chose it, and follows F11 or Esc', () => {
    localStorage.setItem('eras-app-fullscreen', '1');
    const full = setUp({});
    full.start();
    expect(calls).toEqual([true]);
    tell?.(false);
    expect(full.on()).toBe(false);
  });

  it('leaves the window as it is when the preference is off, and sets it from Preferencias', () => {
    const full = setUp({});
    full.start();
    expect(calls).toEqual([]);
    full.set(true);
    expect(calls).toEqual([true]);
    expect(full.on()).toBe(true);
  });

  it('is not offered in the browser tab nor on a phone (always full screen there)', () => {
    expect(setUp({ installed: false }).available).toBe(false);
    TestBed.resetTestingModule();
    expect(setUp({ fullscreenToggle: false }).available).toBe(false);
  });
});
