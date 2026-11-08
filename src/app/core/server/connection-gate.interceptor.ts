import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { ServerAccess, isServerRequest } from './server-access';

/** What a screen says when something needs the server and the installed app is not connected. */
export const NOT_CONNECTED_MESSAGE = 'Conéctate para usar esta función (toca «Conectar»).';
const NOT_CONNECTED = 'Not connected';

/**
 * The installed app before connecting (local-first, ServerAccess): no request reaches the server. An API request is
 * answered at once with a "no connection" error (status 0, as offline, so screens keep what they show offline) that
 * says to connect. The first interceptor: nothing else (the session's header, the warm-up's "it fell asleep") sees
 * it. In the browser, and once connected, it does nothing.
 */
export const connectionGateInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isServerRequest(req.url) || inject(ServerAccess).allowed()) return next(req);
  return throwError(() => new HttpErrorResponse({ status: 0, statusText: NOT_CONNECTED, url: req.url, error: { message: NOT_CONNECTED_MESSAGE } }));
};

/** The error the gate gives (not a real failure of the server). */
export function isNotConnected(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 0 && error.statusText === NOT_CONNECTED;
}
