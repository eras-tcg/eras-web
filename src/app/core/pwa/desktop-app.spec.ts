import { isWindows, offersDesktopApp, publishedExe } from './desktop-app';

describe('"Descargar para Windows"', () => {
  it('on a Windows PC, outside the Windows app, when the site publishes an installer', () => {
    expect(offersDesktopApp({ windows: true, desktop: false, exe: '/app/ERAS-Setup.exe' })).toBe(true);
    expect(offersDesktopApp({ windows: true, desktop: true, exe: '/app/ERAS-Setup.exe' })).toBe(false);
    expect(offersDesktopApp({ windows: false, desktop: false, exe: '/app/ERAS-Setup.exe' })).toBe(false);
    expect(offersDesktopApp({ windows: true, desktop: false, exe: null })).toBe(false);
  });

  it('knows a Windows PC by its browser', () => {
    expect(isWindows('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0')).toBe(true);
    expect(isWindows('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15')).toBe(false);
    expect(isWindows('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')).toBe(false);
  });

  it("downloads the manifest's installer from the site it is on", () => {
    expect(publishedExe({ exe: 'https://www.erastcg.com/app/ERAS-Setup.exe' })).toBe('/app/ERAS-Setup.exe');
    expect(publishedExe({ exe: '/app/ERAS-Setup.exe' })).toBe('/app/ERAS-Setup.exe');
    expect(publishedExe({ exe: 'https://www.erastcg.com/app/ERAS.apk' })).toBeNull();
    expect(publishedExe(null)).toBeNull();
  });
});
