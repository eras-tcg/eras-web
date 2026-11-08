import type { IconName } from '@ui/primitives/icon/icon.component';

/**
 * The installed app's connection to the server in this visit (local-first: it starts without it):
 * - idle: not connected (what needs the server asks to connect first);
 * - connecting: waking the server up (the warm-up screen shows) and checking the session;
 * - connected: as the site in the browser, for the rest of the visit;
 * - failed: the server did not wake up (the warm-up screen offers to try again or to go on without it).
 */
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'failed';

export type ConnectionEvent = 'connect' | 'ready' | 'failed' | 'cancel';

/** The state after an event (anything that does not apply leaves it as it is; connected stays connected). */
export function nextConnectionState(state: ConnectionState, event: ConnectionEvent): ConnectionState {
  switch (state) {
    case 'idle':
    case 'failed':
      if (event === 'connect') return 'connecting';
      if (event === 'cancel') return 'idle';
      return state;
    case 'connecting':
      if (event === 'ready') return 'connected';
      if (event === 'failed') return 'failed';
      if (event === 'cancel') return 'idle';
      return state;
    case 'connected':
      return state;
  }
}

/** What the "Conectar" control shows. */
export interface ConnectionView {
  label: 'Sin conectar' | 'Conectando…' | 'Conectado' | 'Sin internet';
  icon: IconName;
  tone: 'idle' | 'busy' | 'ok' | 'off';
  /** Tapping it connects. */
  actionable: boolean;
}

/** Without internet that is what it says, whatever the state; otherwise the state. */
export function connectionView(state: ConnectionState, online: boolean): ConnectionView {
  if (!online) return { label: 'Sin internet', icon: 'wifi-off', tone: 'off', actionable: false };
  switch (state) {
    case 'connecting':
      return { label: 'Conectando…', icon: 'cloud', tone: 'busy', actionable: false };
    case 'connected':
      return { label: 'Conectado', icon: 'cloud', tone: 'ok', actionable: false };
    default:
      return { label: 'Sin conectar', icon: 'cloud-off', tone: 'idle', actionable: true };
  }
}
