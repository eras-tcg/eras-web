// Writes the Android app's update manifest next to the site (CI, job "android"; see README, "The Android app"):
//
//   node scripts/app-update.mjs <web zip> <out dir> [site]
//
// <web zip>: the Capacitor build zipped (index.html at its root), already in <out dir> as web-<version>.zip.
// <out dir>/app-update.json: {version, url, sha256, minNativeVersion, apk, apkVersion, apkVersionCode}. The app
// downloads the zip when its version is newer than its own web part and its APK is at least minNativeVersion
// (android/native-release.json); otherwise, with an older APK, it offers the new APK (<site>/app/ERAS.apk).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [zip, out, site = 'https://www.erastcg.com'] = process.argv.slice(2);
if (!zip || !out) {
  console.error('usage: node scripts/app-update.mjs <web zip> <out dir> [site]');
  process.exit(2);
}
const root = new URL('..', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const { minNativeVersion } = JSON.parse(readFileSync(new URL('android/native-release.json', root), 'utf8'));
const [major, minor, fixes] = version.split('.').map(Number);
const apkVersionCode = major * 10000 + minor * 100 + fixes;
if (!Number.isInteger(minNativeVersion) || minNativeVersion > apkVersionCode) {
  console.error(`minNativeVersion ${minNativeVersion} must be an APK versionCode not above this one (${apkVersionCode})`);
  process.exit(1);
}
const manifest = {
  version,
  url: `${site}/app/${basename(zip)}`,
  sha256: createHash('sha256').update(readFileSync(zip)).digest('hex'),
  minNativeVersion,
  apk: `${site}/app/ERAS.apk`,
  apkVersion: version,
  apkVersionCode,
};
writeFileSync(join(out, 'app-update.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
