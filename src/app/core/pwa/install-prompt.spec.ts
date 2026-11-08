import { TestBed } from '@angular/core/testing';
import { InstallPrompt, installOffer, isAndroid, isIos, isStandalone } from './install-prompt';

function fakePrompt(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('installOffer', () => {
  it('the browser prompt when it offers one, iPhone instructions otherwise, nothing once installed', () => {
    expect(installOffer({ installed: false, canPrompt: true, ios: false })).toBe('prompt');
    expect(installOffer({ installed: false, canPrompt: false, ios: true })).toBe('ios');
    expect(installOffer({ installed: false, canPrompt: false, ios: false })).toBe('none');
    expect(installOffer({ installed: true, canPrompt: true, ios: true })).toBe('none');
    // Android without the browser's prompt: the menu's "Instalar app", explained
    expect(installOffer({ installed: false, canPrompt: false, ios: false, android: true })).toBe('android');
    expect(installOffer({ installed: false, canPrompt: true, ios: false, android: true })).toBe('prompt');
    expect(installOffer({ installed: true, canPrompt: false, ios: false, android: true })).toBe('none');
    expect(isAndroid('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe(true);
    expect(isAndroid('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36')).toBe(false);
  });
});

describe('isIos / isStandalone', () => {
  it('knows iPhone and iPadOS (which says it is a Mac), not a Mac or Android', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l', 5)).toBe(false);
  });

  it('is standalone in the app window (display-mode) or an iPhone home screen app', () => {
    const win = (modes: string[], standalone?: boolean) =>
      ({ matchMedia: (q: string) => ({ matches: modes.some((m) => q.includes(m)) }), navigator: { standalone } }) as unknown as Window;
    expect(isStandalone(win([]))).toBe(false);
    expect(isStandalone(win(['standalone']))).toBe(true);
    expect(isStandalone(win(['fullscreen']))).toBe(true);
    expect(isStandalone(win([], true))).toBe(true);
  });
});

describe('InstallPrompt', () => {
  afterEach(() => {
    delete (window as { __erasInstallPrompt?: unknown }).__erasInstallPrompt;
    delete (window as { __erasInstalled?: unknown }).__erasInstalled;
  });

  it('offers nothing until the browser offers the installation, then shows its prompt once', async () => {
    const installer = TestBed.inject(InstallPrompt);
    expect(installer.offer()).toBe('none');
    const offer = fakePrompt('accepted');
    window.dispatchEvent(offer);
    expect(offer.defaultPrevented).toBe(true);
    expect(installer.offer()).toBe('prompt');
    expect(await installer.install()).toBe('accepted');
    expect(offer.prompt).toHaveBeenCalledTimes(1);
    expect(installer.installed()).toBe(true);
    expect(installer.offer()).toBe('none');
    expect(await installer.install()).toBe('unavailable');
  });

  it('a dismissed prompt is not shown again until the browser offers it again', async () => {
    const installer = TestBed.inject(InstallPrompt);
    window.dispatchEvent(fakePrompt('dismissed'));
    expect(await installer.install()).toBe('dismissed');
    expect(installer.installed()).toBe(false);
    expect(installer.offer()).toBe('none');
  });

  it('takes the offer index.html caught before the app started, and hides once installed', () => {
    (window as { __erasInstallPrompt?: unknown }).__erasInstallPrompt = fakePrompt('accepted');
    const installer = TestBed.inject(InstallPrompt);
    expect(installer.offer()).toBe('prompt');
    window.dispatchEvent(new Event('appinstalled'));
    expect(installer.installed()).toBe(true);
    expect(installer.offer()).toBe('none');
  });
});
