import { Injectable, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import type { LocalMatchConfig } from './engine-protocol';
import { GameTransport, StompTransport } from './game-transport';
import { LocalEngine, LocalTransport } from './local-transport';

/** Same-origin WebSocket: nginx (and the dev proxy) forward /ws to DriveManager. */
function wsUrl(): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
}

/** Makes the game store's transports: the server's rooms (online) or the engine in the browser (offline). */
@Injectable({ providedIn: 'root' })
export class GameTransports {
  private readonly auth = inject(AuthService);
  private readonly engine = inject(LocalEngine);

  stomp(timeoutMs?: number): GameTransport {
    return new StompTransport(wsUrl(), () => this.auth.token(), timeoutMs);
  }

  local(config: LocalMatchConfig): GameTransport {
    return new LocalTransport(this.engine, config);
  }
}
