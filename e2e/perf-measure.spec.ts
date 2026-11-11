import { Browser, Page, expect, test } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Measures how long simulator actions take against a deployment (temporary, not part of the suite):
 * round trip from the STOMP SEND to the state MESSAGE, message size, the app's handler time and the time to the next paint.
 *   E2E_BASE_URL=https://staging.erastcg.com npx playwright test perf-measure
 */
interface Account { username: string; password: string }
const authFile = join(__dirname, '.auth.local.json');
const auth: { baseURL?: string; accounts?: Account[] } = existsSync(authFile) ? JSON.parse(readFileSync(authFile, 'utf8')) : {};
const accounts = auth.accounts ?? [];
test.skip(accounts.length < 2 || process.env['E2E_BASE_URL'] !== auth.baseURL, 'Requiere cuentas de staging');
test.setTimeout(240_000);

/** Wraps the page's WebSocket: every action SEND and every MESSAGE frame is timed in window.__perf. */
const hook = () => {
  const w = window as unknown as { __perf: unknown[]; __lastSend: { t: number; type: string } | null; __ws: WebSocket | null };
  w.__perf = [];
  w.__lastSend = null;
  w.__ws = null;
  const Native = window.WebSocket;
  const Timed = function (this: unknown, url: string | URL, protocols?: string | string[]) {
    const ws = protocols === undefined ? new Native(url) : new Native(url, protocols);
    w.__ws = ws;
    ws.addEventListener('message', (e: MessageEvent) => {
      const data = typeof e.data === 'string' ? e.data : '';
      if (!data.startsWith('MESSAGE')) return;
      const arrived = performance.now();
      const send = w.__lastSend;
      w.__lastSend = null;
      const entry: Record<string, unknown> = { action: send?.type ?? null, rtt: send ? arrived - send.t : null, bytes: data.length, handler: null, paint: null };
      w.__perf.push(entry);
      // After the app's own handler and its change detection
      setTimeout(() => { entry['handler'] = performance.now() - arrived; }, 0);
      requestAnimationFrame(() => requestAnimationFrame(() => { entry['paint'] = performance.now() - arrived; }));
    });
    const send = ws.send.bind(ws);
    ws.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      if (typeof data === 'string' && data.startsWith('SEND')) {
        const m = /"type":"([A-Z_]+)"/.exec(data);
        w.__lastSend = { t: performance.now(), type: m?.[1] ?? '?' };
      }
      send(data);
    };
    return ws;
  } as unknown as typeof WebSocket;
  Object.assign(Timed, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  (Timed as unknown as { prototype: unknown }).prototype = Native.prototype;
  window.WebSocket = Timed;
};

async function player(browser: Browser, account: Account): Promise<Page> {
  const context = await browser.newContext({ baseURL: process.env['E2E_BASE_URL'], locale: 'es-CL' });
  const page = await context.newPage();
  await page.addInitScript(hook);
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(account.username);
  await page.getByLabel('Contraseña').fill(account.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

/** Sends a raw action and waits for its MESSAGE. */
async function act(page: Page, roomId: string, type: string, payload: Record<string, unknown> = {}): Promise<void> {
  const before = await page.evaluate(() => (window as unknown as { __perf: unknown[] }).__perf.length);
  await page.evaluate(({ roomId, type, payload }) => {
    const body = JSON.stringify({ type, payload });
    (window as unknown as { __ws: WebSocket }).__ws.send(`SEND\ndestination:/app/room/${roomId}/action\ncontent-type:application/json\ncontent-length:${new TextEncoder().encode(body).length}\n\n${body}\0`);
  }, { roomId, type, payload });
  await page.waitForFunction((n) => (window as unknown as { __perf: unknown[] }).__perf.length > n, before, { timeout: 15_000 });
  await page.waitForTimeout(150);
}

test('tiempos de las acciones del simulador', async ({ browser }) => {
  const host = await player(browser, accounts[0]);
  const guest = await player(browser, accounts[1]);
  await host.goto('/simulator');
  await host.getByRole('button', { name: 'Crear sala' }).click();
  await expect(host).toHaveURL(/\/board$/);
  const roomPath = new URL(host.url()).pathname.replace(/\/board$/, '');
  const roomId = roomPath.split('/').pop() as string;
  await host.getByRole('button', { name: /^Ver / }).first().click();
  await guest.goto(roomPath + '/board');
  await guest.getByRole('button', { name: /^Ver / }).first().click();
  await host.getByRole('button', { name: 'Yo', exact: true }).click();
  for (const page of [host, guest]) await page.getByRole('button', { name: 'Comenzar partida' }).click();
  for (const page of [host, guest]) await page.getByRole('button', { name: 'Quedarme con todas' }).click();
  await expect(host.getByText('Turno aliado').first()).toBeVisible();
  await host.evaluate(() => { (window as unknown as { __perf: unknown[] }).__perf.length = 0; });
  // PERF_THROTTLE=kbps: a slower connection (download and upload in kilobits per second, 0 extra latency)
  const kbps = Number(process.env['PERF_THROTTLE'] ?? 0);
  if (kbps > 0) {
    const cdp = await host.context().newCDPSession(host);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: (kbps * 1000) / 8, uploadThroughput: (kbps * 500) / 8 });
  }

  // Small error answers: the network and the server with almost no work
  for (let i = 0; i < 8; i++) await act(host, roomId, 'NO_SUCH_ACTION');
  // Ordinary actions with a full state update
  for (let i = 0; i < 8; i++) await act(host, roomId, 'DRAW_CARD');
  for (let i = 0; i < 4; i++) {
    await act(host, roomId, 'SHUFFLE_DECK');
  }
  await act(host, roomId, 'END_TURN');

  const perf = await host.evaluate(() => (window as unknown as { __perf: unknown[] }).__perf);
  const out = process.env['PERF_OUT'] ?? join(__dirname, '..', 'perf-results.json');
  writeFileSync(out, JSON.stringify(perf, null, 1));
  console.log('PERF ' + JSON.stringify(perf));
});
