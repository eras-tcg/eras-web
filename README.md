# ErasWeb

Front Angular de ERAS (reemplazo del front Vue). **Estado y cómo retomar:** [`docs/HANDOFF.md`](docs/HANDOFF.md) · plan: [`docs/PLAN_MIGRACION_FRONT_ANGULAR.md`](docs/PLAN_MIGRACION_FRONT_ANGULAR.md) · paridad: [`docs/PARIDAD.md`](docs/PARIDAD.md).

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Modo solo sin conexión (offline game against the bot)

"Jugar" → **Modo solo sin conexión** plays against the bot entirely in the browser: DriveManager's own engine
(rules and bot, Kotlin/JS) runs in a Web Worker and answers the board's actions with the same messages the server
would push, so the board and `GameStore` are the same as online. The option is always listed and moves to the top
(with a notice) when the browser is offline or the server cannot be reached.

- **How it is wired** (`src/app/data-access/simulator`): `GameStore` talks to a `GameTransport` — `StompTransport`
  (online, unchanged) or `LocalTransport`, which drives `engine.worker.ts` through `LocalEngine` (one worker per visit,
  cards installed once). `OfflineGame` builds the game: the starter decks (`/engine/starter-decks.json`) and the
  player's own decks, loaded in this visit or kept on the device (`local-decks.ts`, mapped as the server's `DeckLoader`
  does). The room is always `local`; `RoomsApi.createLocal()`/`get('local')` describe it without the server.
- **Not available offline:** manual (editor) actions, ranked, missions and rewards, the match history, reconnection
  and sharing the room. A reload ends the game (back to "Jugar"; the decks are still offered).

### Installable app (PWA) and offline start

The production builds (`production`, `staging`, `aws`) register a service worker, `public/eras-sw.js`: Angular's
`ngsw-worker.js` (configured by `ngsw-config.json`) plus a cache for the card pictures. It is registered once the app
is stable (`registerWhenStable:30000`), or at once when the player opens "Descargar para jugar sin conexión".

- **What it keeps:** on install it downloads the app shell and every chunk (the board, the engine's worker), the fonts,
  icons, card back and `/engine/*.json` (prefetch groups; the engine's `?v=` is ignored for the match). `/images/**`
  is kept as it is used. It never keeps `/api`, `/ws`, `/wake`, the login or anything of the account (no data groups;
  those paths are not navigations either).
- **Card pictures** (another origin, the R2 image host): cross-origin `<img>` requests are answered cache first from
  `eras-card-images-v1` (CORS when the host allows it, otherwise an opaque response; at most 1500, the oldest go
  first; the URLs carry `?v=` so they never go stale). "Jugar" → **Descargar para jugar sin conexión** downloads the
  pictures of the starter decks and of the player's saved decks into that cache: progress, size estimate, cancel, a
  warning on data saving / mobile data, and the device's storage (`navigator.storage.estimate`). It also asks the
  browser to keep the storage (`navigator.storage.persist`), as installing does; a first visit never asks.
- **Decks for offline:** whenever the player's decks and the card catalog are loaded online they are kept in IndexedDB
  (`eras` / `kv`, key `offline-library:<userId>`: the decks and only the catalog's part they and the starter decks
  need; `offline-library-sync.ts`). Modo solo sin conexión offers them after a reload or an offline start. Signing
  out deletes them.
- **Offline start:** the installed app opens without the network on "Jugar" (from the home), without waiting for the
  backend (the AWS warm-up screen is skipped while offline), with a "Sin conexión" notice and the server's modes left
  out. An expired session is kept until the connection is back (and never ends an offline game); it then goes to the
  login as before. Without any session, the login says it needs internet once.
- **Install:** "Jugar" → **Instalar ERAS** shows the browser's prompt (`beforeinstallprompt`, caught from the start
  by `index.html`) or, on iPhone/iPad, how to add it (Compartir → Agregar a inicio). Hidden once installed. Manifest:
  `public/manifest.webmanifest` (icons in `public/icons`, maskable 192/512).
- **Updates:** the service worker checks for a new version every 5 minutes and when the tab is shown; when it is ready
  the header says "Nueva versión disponible – Recargar" (never over a game's table, never reloading by itself). If
  the service worker lost part of the running version, it asks to reload.
- **Serving:** `ngsw.json`, `ngsw-worker.js`, `eras-sw.js`, `index.html` and the manifest must be revalidated
  (`no-cache`), hashed bundles immutable, JS/JSON compressed (`nginx.*.conf` do it; the AWS deploy is in eras-tcg/infra).
- **Tests:** `npm run e2e:pwa` builds and runs `e2e/pwa` against the production build: online once, then offline and
  reopened, a game with the deck kept on the device, and the install button.

### Updating the vendored engine

The engine lives in [`vendor/eras-engine`](vendor/eras-engine/README.md) (built from DriveManager/eras-engine; the
README there and `BUILD.json` say which commit). eras-web's build only reads that folder. To update it:

```bash
cd ../DriveManager/eras-engine && ./gradlew jsBrowserProductionLibraryDistribution
cd ../../eras-web && npm run engine:update   # copies the package, writes BUILD.json and engine-build.ts
```

Then update the "Built from" line of `vendor/eras-engine/README.md` and commit the folder with
`src/app/data-access/simulator/engine-build.ts`.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
