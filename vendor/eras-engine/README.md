# vendor/eras-engine

The ERAS game engine for the browser (`@eras/engine`), as DriveManager's `eras-engine` builds it
(`./gradlew jsBrowserProductionLibraryDistribution` → `build/dist/js/productionLibrary`). It runs "Modo solo sin conexión":
a game against the bot played entirely in the browser, in a Web Worker (`src/app/data-access/simulator/engine.worker.ts`).

**Built from:** DriveManager `6898185a45a08d4febbaf6f0c5ce46ca44fc1734` (eras-engine phase 3, "fix(engine): the npm
distribution and the smoke run order themselves after the Node distribution"). `BUILD.json` records the commit of the
copy in this folder.

| File | What | How the site uses it |
|---|---|---|
| `eras-engine.mjs`, `kotlin-*.mjs`, `kotlinx-*.mjs` | The engine (Kotlin/JS ES modules) | Imported only by the worker (`@eras/engine`, a path in `tsconfig.json`): bundled into the worker's own chunk |
| `eras-engine.d.mts` | Its TypeScript types | `EngineApi`, `LocalMatch` |
| `card-bundle.json` | The 358 programmed cards | Served at `/engine/card-bundle.json` (angular.json assets), fetched by the worker |
| `bot-resources.json` | The bot's levels and models | Served at `/engine/bot-resources.json`, fetched by the worker |
| `starter-decks.json` | ST1–ST4 as `LocalMatch` decks | Served at `/engine/starter-decks.json`, fetched when an offline game starts |
| `package.json` | The package's manifest | Reference only |

## Updating

```bash
cd ../DriveManager/eras-engine && ./gradlew jsBrowserProductionLibraryDistribution
cd ../../eras-web && npm run engine:update      # or ERAS_ENGINE_DIST=<dir> npm run engine:update
```

`scripts/engine-update.mjs` copies the files (not the source maps), writes `BUILD.json` and
`src/app/data-access/simulator/engine-build.ts` (its id versions the `/engine/*.json` URLs, so browsers fetch the new
assets). Update the "Built from" line above, then commit the folder together with `engine-build.ts`. eras-web's build
never needs DriveManager: it only reads this folder.
