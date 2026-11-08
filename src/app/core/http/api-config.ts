import { Injectable } from '@angular/core';
import { environment } from '@env';
import type { Environment } from '../../../environments/environment.model';

@Injectable({ providedIn: 'root' })
export class ApiConfig {
  url(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }
}

type Place = Pick<Location, 'protocol' | 'host' | 'origin'>;

/** The simulator's socket: the environment's (the Android app: the public site's), or /ws on the page's own origin. */
export function socketUrl(env: Pick<Environment, 'wsUrl'> = environment, place: Place = location): string {
  return env.wsUrl || `${place.protocol === 'https:' ? 'wss:' : 'ws:'}//${place.host}/ws`;
}

/** The public site's origin, for links other players open (the Android app's own origin is https://localhost). */
export function siteOrigin(env: Pick<Environment, 'siteUrl'> = environment, place: Place = location): string {
  return (env.siteUrl || place.origin).replace(/\/+$/, '');
}
