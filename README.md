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
  player's own decks when they and the card catalog are loaded (`local-decks.ts`, mapped as the server's `DeckLoader`
  does). The room is always `local`; `RoomsApi.createLocal()`/`get('local')` describe it without the server.
- **Not available offline:** manual (editor) actions, ranked, missions and rewards, the match history, reconnection
  and sharing the room. A reload ends the game (back to "Jugar").
- **Needs the connection once per visit:** the worker chunk (~854 kB, ~197 kB gzipped) and the engine's data
  (`/engine/card-bundle.json`, `bot-resources.json`) are downloaded the first time the option is opened; after that,
  games keep working without the network. Card pictures come from the image host: offline only the ones the browser
  already has are shown (the rest show the card's name). Caching it all for a cold offline start is phase 5 (service worker).

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
