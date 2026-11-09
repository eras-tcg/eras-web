import { Client } from '@stomp/stompjs';

/** What a transport tells the store about its room. */
export interface TransportEvents {
  /** A message for this player: what the server pushes to /user/queue/room/{id} (a `GameState` as JSON). */
  message(body: string): void;
  /** Connected; `again`: after the connection dropped and came back by itself (the store joins the room again). */
  connected(again: boolean): void;
  disconnected(): void;
  /** The connection itself failed (not a refused action: those come as messages). */
  failed(message: string): void;
}

/**
 * How the game store reaches a room: the server over STOMP (online) or the engine in a Web Worker (Modo solo sin
 * conexión). Both speak the same protocol, the bodies the board publishes in and the server's messages out, so
 * the store and everything that draws its state are the same for both.
 */
export interface GameTransport {
  /** The game runs in this browser (no server). */
  readonly local: boolean;
  /** Opens the room; resolves once actions can be sent (rejects on a timeout or a failure). */
  open(roomId: string, events: TransportEvents): Promise<void>;
  readonly isOpen: boolean;
  /** Sends an action's body (`{"type", "payload"}`) to the room; false when it could not be sent. */
  publish(roomId: string, body: string): boolean;
  /** The bots wait while `held` (only where the game runs in this browser). */
  holdBots?(held: boolean): void;
  close(): void;
}

/** The server's rooms over STOMP: /user/queue/room/{id} in (this player's own view), /app/room/{id}/action out. */
export class StompTransport implements GameTransport {
  readonly local = false;
  private client: Client | null = null;

  constructor(
    private readonly brokerUrl: string,
    private readonly token: () => string | null,
    private readonly timeoutMs = 8000,
  ) {}

  get isOpen(): boolean {
    return !!this.client?.connected;
  }

  open(roomId: string, events: TransportEvents): Promise<void> {
    this.close();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), this.timeoutMs);
      let reconnecting = false;
      const client = new Client({
        brokerURL: this.brokerUrl,
        connectHeaders: { Authorization: `Bearer ${this.token() ?? ''}` },
        reconnectDelay: 3000,
        onConnect: () => {
          clearTimeout(timeout);
          client.subscribe(`/user/queue/room/${roomId}`, (msg) => events.message(msg.body));
          events.connected(reconnecting);
          reconnecting = true;
          resolve();
        },
        onStompError: (frame) => events.failed(frame.headers['message'] ?? 'Error de conexión con la sala'),
        onWebSocketClose: () => events.disconnected(),
        onDisconnect: () => events.disconnected(),
      });
      this.client = client;
      client.activate();
    });
  }

  publish(roomId: string, body: string): boolean {
    if (!this.client?.connected) return false;
    this.client.publish({ destination: `/app/room/${roomId}/action`, body });
    return true;
  }

  close(): void {
    void this.client?.deactivate();
    this.client = null;
  }
}
