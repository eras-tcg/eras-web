import { offersAndroidApp, publishedApk } from './android-app';

describe('"Descargar la app para Android"', () => {
  it('on Android, outside the app, when the site publishes an APK', () => {
    expect(offersAndroidApp({ android: true, native: false, apk: '/app/ERAS.apk' })).toBe(true);
    expect(offersAndroidApp({ android: true, native: true, apk: '/app/ERAS.apk' })).toBe(false);
    expect(offersAndroidApp({ android: false, native: false, apk: '/app/ERAS.apk' })).toBe(false);
    // A deploy without the signing key publishes no APK: the PWA's "Instalar ERAS" stays
    expect(offersAndroidApp({ android: true, native: false, apk: null })).toBe(false);
  });

  it("downloads the manifest's APK from the site it is on", () => {
    expect(publishedApk({ apk: 'https://www.erastcg.com/app/ERAS.apk' })).toBe('/app/ERAS.apk');
    expect(publishedApk({ apk: '/app/ERAS.apk' })).toBe('/app/ERAS.apk');
    expect(publishedApk({ apk: 'https://www.erastcg.com/app/web.zip' })).toBeNull();
    expect(publishedApk({})).toBeNull();
    expect(publishedApk(null)).toBeNull();
  });
});
