/// <reference lib="webworker" />
/**
 * The game engine in a Web Worker ("Modo solo sin conexión"): DriveManager's own rules and bot (vendor/eras-engine,
 * `LocalMatch`), so a game against the bot needs no server. The page sends it the player's actions as it would publish
 * them online; it posts back each message the server would push to the player, in the same order, and moves the bot
 * at the server's pace (`step()` after `botPauseMs()`, until it has nothing to do). Only this worker imports the
 * engine: it is its own chunk, loaded the first time an offline game is opened.
 */
import { EngineApi, LocalMatch } from '@eras/engine';
import type { EngineAssets, FromEngine, ToEngine } from './engine-protocol';
import { GameRecorder } from './offline-record';

const post = (message: FromEngine) => postMessage(message);

let installed: Promise<void> | null = null;
/** The game under way and its id (from the page); the bot's next move, when one is due. */
let match: LocalMatch | null = null;
let matchId = -1;
let botTimer: ReturnType<typeof setTimeout> | null = null;
/** The game's record (every action and the bot's moves after it), posted each time the room reaches its post-game. */
let recorder: GameRecorder | null = null;

/** After an action or a move of the bot: a game that just ended is posted, recorded, for its rewards once connected. */
function recordEnd(id: number, game: LocalMatch): void {
  const finished = recorder?.check(game.status(), () => game.result(), Date.now());
  if (finished) post({ kind: 'finished', id, game: finished });
}

/** The cards and the bot's resources, installed once (the engine reads them before its first game). */
function install(assets: EngineAssets): Promise<void> {
  installed ??= (async () => {
    const [bundle, resources] = await Promise.all([text(assets.cardBundleUrl), text(assets.botResourcesUrl)]);
    const api = EngineApi.getInstance();
    const cards = api.installCards(bundle);
    const botResources = api.installBotResources(resources);
    post({ kind: 'ready', cards, botResources });
  })();
  // A failed load may be tried again (the connection came back)
  installed.catch(() => (installed = null));
  return installed;
}

async function text(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}

function stopBot(): void {
  if (botTimer !== null) clearTimeout(botTimer);
  botTimer = null;
}

/** Every message of the game, as it comes. */
function deliver(id: number, bodies: readonly string[] | null | undefined): void {
  for (const body of bodies ?? []) post({ kind: 'message', id, body });
}

/**
 * The bot moves after the player's action, one move every `botPauseMs()` (as the server's bot waits before each), until
 * it has nothing to do. An action that arrives meanwhile is applied between two moves.
 */
function pumpBot(): void {
  if (botTimer !== null || !match) return;
  const game = match;
  const id = matchId;
  const next = () => {
    botTimer = null;
    if (game !== match) return;
    let moves: string[] | null | undefined;
    try {
      moves = game.step();
    } catch (e) {
      post({ kind: 'error', id, message: errorText(e) });
      return;
    }
    if (moves === null || moves === undefined) return;
    recorder?.botMoved();
    deliver(id, moves);
    recordEnd(id, game);
    botTimer = setTimeout(next, game.botPauseMs());
  };
  botTimer = setTimeout(next, game.botPauseMs());
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

addEventListener('message', async ({ data }: MessageEvent<ToEngine>) => {
  switch (data.kind) {
    case 'init':
      try {
        await install(data.assets);
      } catch (e) {
        post({ kind: 'error', id: null, message: errorText(e) });
      }
      return;
    case 'create':
      stopBot();
      match = null;
      recorder = null;
      try {
        if (!installed) throw new Error('El motor no está cargado');
        await installed;
        match = new LocalMatch(JSON.stringify(data.config));
        matchId = data.id;
        recorder = new GameRecorder(data.config, Date.now());
        post({ kind: 'created', id: data.id, roomId: match.roomId, userId: match.userId });
      } catch (e) {
        post({ kind: 'error', id: data.id, message: errorText(e) });
      }
      return;
    case 'action': {
      if (!match || data.id !== matchId) return;
      let sent: string[];
      recorder?.action(data.body);
      try {
        sent = match.send(data.body);
      } catch (e) {
        post({ kind: 'error', id: data.id, message: errorText(e) });
        return;
      }
      deliver(data.id, sent);
      recordEnd(data.id, match);
      if (!sent.length) {
        const why = match.lastError();
        if (why) post({ kind: 'error', id: data.id, message: why });
      }
      pumpBot();
      return;
    }
    case 'dispose':
      if (data.id !== matchId) return;
      stopBot();
      match = null;
      recorder = null;
      return;
  }
});
