# eras-web: guía para agentes

Front de ERAS TCG en Angular 22. Se publica de tres formas, y las tres usan el mismo código:

| Forma | Dónde | Detalle |
|---|---|---|
| Sitio | `https://www.erastcg.com` (S3 + CloudFront) | build `aws`; `erastcg.com` redirige a www |
| PWA instalable | el mismo sitio | service worker ngsw + `public/eras-sw.js` |
| App Android | `https://www.erastcg.com/app/ERAS.apk` | Capacitor (`android/`), build `capacitor`, origen `https://localhost` |

El juego offline usa el motor de DriveManager (`eras-engine`) incluido en `vendor/eras-engine`, que corre en un Web Worker (`data-access/simulator/engine.worker.ts`, `LocalTransport`). Se actualiza con `npm run engine:update`, leyendo de `../DriveManager/eras-engine/build/dist/js/productionLibrary`.

**El README tiene el detalle de cada parte**: modo sin conexión, app instalada local primero (2.5), partidas offline que cuentan (2.6) y la app Android (2.7): actualizaciones, cómo publicar y la clave de firma. `docs/HANDOFF.md` y `docs/PLAN_MIGRACION_FRONT_ANGULAR.md` describen la migración de Vue a Angular, que terminó el 27 de octubre de 2026 (son históricos).

## Compilar y probar

```bash
npm ci
npm run lint
npx ng test --watch=false            # Vitest, ~360 tests
npm run build                        # producción; el bundle inicial está en ~500 kB (límite de aviso), lo nuevo debe ir en chunks lazy
npx ng build --configuration capacitor && npx cap sync android   # app Android (el APK se compila en el CI)
npm run e2e:pwa                      # Playwright contra los builds de producción y aws (PWA, offline, local primero)
```

- `e2e/pwa/pwa-server.ts` imita a CloudFront, incluida su regla de rewrite: un archivo con extensión de más de 12 caracteres recibe `index.html`.
- Los e2e que dependen de staging (`playwright.config.ts`) fallan si no hay acceso a staging.erastcg.com.

## Modos de la app (`core/pwa/app-mode.ts`)

- **`app`**: la PWA instalada (display-mode standalone o fullscreen) o la app nativa (Capacitor).
  - **Local primero**: no llama a `/api` ni a `/wake` hasta que el jugador pide algo online o toca "Conectar" (`core/server/connection*.ts` y el interceptor `connection-gate`). Lo que funciona sin servidor está en `routeNeedsServer`.
  - Siempre horizontal y en pantalla completa. Las barras del sistema nunca achican la vista: `--app-width`, `--app-height`, `--app-vw` y `--app-vh` en `core/pwa/app-screen.ts`.
  - Guarda solas las imágenes de las cartas al conectar (`offline-pictures-auto.ts`) y envía las partidas offline al conectar (`offline-games-upload.ts`).
- **`browser`**: la pestaña del navegador, que se comporta como siempre.

## Versiones y actualizaciones

- La versión vive en `package.json`, `package-lock.json` y `src/app/core/version/app-version.ts`. Sigue semver: fix → patch, funcionalidad → minor.
- **PWA**: `VersionService` revisa al arrancar y se recarga sola en una pantalla segura, nunca en una partida, el constructor de mazos ni al abrir sobres.
- **App Android**:
  - los cambios web llegan por live update (`@capgo/capacitor-updater` autoalojado con `/app/app-update.json` y el zip, con SHA-256 y rollback);
  - un cambio nativo (Java, manifiesto o plugins) requiere subir `minNativeVersion` en `android/native-release.json`, y la app avisa que hay un APK nuevo;
  - `versionCode` se deriva de la versión (2.7.0 → 20700).
- **Firma del APK**: secretos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`eras`) y `ANDROID_KEY_PASSWORD`. La clave la guarda el dueño; si se pierde, la app no se puede actualizar. Sin secretos, el CI firma con la clave de debug y no publica.

## Despliegue

- Rama de trabajo → PR a **`main`**. El CI corre `lint-test`, `build` (aws), `android` (APK), `site` (junta el sitio con `/app/*`), `deploy-staging` y `deploy-production`.
- Producción **espera la aprobación del dueño**; un agente no puede aprobar.
- Los despliegues a `main` van de a uno: si uno queda sin aprobar, bloquea los siguientes. Un run viejo superado por otro se puede cancelar.
- Un cambio en `deploy-site.sh` (repo infra) tiene que mergearse **antes** que el eras-web que lo necesita, porque el despliegue usa infra@main.
- Si el front depende de un endpoint nuevo de DriveManager, DriveManager se despliega primero.

## Pendientes del dueño

- `cd infra/aws && npx cdk deploy ErasSiteProd ErasSiteStaging --profile eras`: activa el 301 de `erastcg.com` a `www` en CloudFront y la regla de extensiones largas. Mientras tanto, la página redirige sola.
- Opcional: una regla CORS en el bucket R2 de imágenes (GET desde `https://www.erastcg.com` y `https://localhost`). Sin ella las imágenes se guardan como opacas: se ven, pero Chrome mide mal el espacio que usan.

## Repos relacionados

- **DriveManager**: servidor y motor (`eras-engine`).
- **ErasUsersService**: login.
- **infra**: AWS y despliegues.
