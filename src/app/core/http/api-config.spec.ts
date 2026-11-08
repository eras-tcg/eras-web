import angular from '../../../../angular.json';
import { environment as aws } from '../../../environments/environment.aws';
import { environment as capacitor } from '../../../environments/environment.capacitor';
import { environment as prod } from '../../../environments/environment.prod';
import { wakeMode } from '../server/server-warmup.service';
import { siteOrigin, socketUrl } from './api-config';

const page = { protocol: 'https:', host: 'www.erastcg.com', origin: 'https://www.erastcg.com' };

describe('where the site talks to the server', () => {
  it('the site: its own origin (CloudFront/nginx send /api, /ws and /wake on)', () => {
    expect(aws.apiBaseUrl).toBe('');
    expect(aws.wakeUrl).toBe('/wake');
    expect(socketUrl(aws, page)).toBe('wss://www.erastcg.com/ws');
    expect(socketUrl({}, { protocol: 'http:', host: 'localhost:4200', origin: 'http://localhost:4200' })).toBe('ws://localhost:4200/ws');
    expect(siteOrigin(aws, page)).toBe('https://www.erastcg.com');
    expect(siteOrigin(prod, { ...page, origin: 'https://staging.erastcg.com' })).toBe('https://staging.erastcg.com');
  });

  it('the Android app (served at https://localhost): the public site by its full address', () => {
    const app = { protocol: 'https:', host: 'localhost', origin: 'https://localhost' };
    expect(capacitor.apiBaseUrl).toBe('https://www.erastcg.com');
    expect(capacitor.wakeUrl).toBe('https://www.erastcg.com/wake');
    expect(socketUrl(capacitor, app)).toBe('wss://www.erastcg.com/ws');
    // A room's link opens the site for the other player, never the app's own origin
    expect(siteOrigin(capacitor, app)).toBe('https://www.erastcg.com');
    expect(capacitor.liveUpdates).toBe(true);
  });

  it('wakes the backend without reading the answer from another origin (no CORS needed)', () => {
    expect(wakeMode('/wake', 'https://www.erastcg.com')).toBe('cors');
    expect(wakeMode('https://www.erastcg.com/wake', 'https://www.erastcg.com')).toBe('cors');
    expect(wakeMode('https://www.erastcg.com/wake', 'https://localhost')).toBe('no-cors');
  });

  it('the build "capacitor" is the AWS one with the app\'s environment and no ngsw (its code is in the APK)', () => {
    const configs = angular.projects['eras-web'].architect.build.configurations as Record<
      string,
      { fileReplacements?: { with: string }[]; serviceWorker?: string; outputPath?: string }
    >;
    expect(configs['capacitor'].fileReplacements?.[0].with).toBe('src/environments/environment.capacitor.ts');
    expect(configs['capacitor'].serviceWorker).toBeUndefined();
    expect(configs['capacitor'].outputPath).toBe('dist/eras-web-capacitor');
    expect(configs['aws'].fileReplacements?.[0].with).toBe('src/environments/environment.aws.ts');
    expect(configs['aws'].serviceWorker).toBe('ngsw-config.json');
  });
});
