# Handoff — migración del front ERAS (Vue → Angular)

Documento para retomar el trabajo. Plan completo: [`PLAN_MIGRACION_FRONT_ANGULAR.md`](PLAN_MIGRACION_FRONT_ANGULAR.md)
(sección 9 = estado detallado por fase). Paridad por ruta: [`PARIDAD.md`](PARIDAD.md).

**Actualizado:** 2026-10-27 · **Último PR:** #15 · **Despliegues (todos Angular):** https://erastcg.com (producción),
https://staging.erastcg.com, https://next.erastcg.com

## Estado en una línea
**Migración completa: producción sirve Angular desde 2026-10-27** (`eras-web:ff32211…-prod`, e2e 14/14 en producción,
15/15 en staging). Rediseño y login obligatorio en producción desde 2026-10-27 (front `5f45fc5…-prod`, DriveManager `fcc84d2`).

| Fase | Estado | PR |
|---|---|---|
| 0. Fundaciones (repo, CI/CD, lint de capas, Vitest, `next`) | ✓ (Storybook pospuesto) | inicial |
| 1. Sistema de diseño (tokens, temas, componentes `ui`) | ✓ (sin Storybook) | inicial |
| 2. Home, Cards, Editions | ✓ | `985f0bb`, `a58696e` |
| 3. Register, Validate, Profile | ✓ | `0db036e` |
| 4. Mazos + BoosterResult | ✓ | `932880f`, `adc7171` |
| 5. Administración + metadatos de cartas | ✓ | #1, #2 |
| 6. Simulador (STOMP) | ✓ (partida real de 2 jugadores en staging) | #3, #9 |
| 7. Corte | ✓ staging y **producción** en Angular (2026-10-27) | #4, #7, #8, #10 |

## Corte: cómo está armado
- Cada push a `main` publica `ghcr.io/eras-tcg/eras-web:<sha>-next|-staging|-prod` y despliega solo a `next`.
- **Run workflow** (eras-web → CI/CD) con `environment` = `next` | `staging` | `production` e `image_tag` = sha.
  Para staging/production despliega como servicio `eras-frontend` (mismos contenedores, puertos y vhosts que erasFront).
  `production` exige la aprobación de CapitanPio en Actions (*Review deployments*).
- **Rollback:** Run workflow en `eras-tcg/erasFront` (CI/CD) con la imagen Vue. Staging: rama `develop`, environment
  `staging`, tag `0d010c9d8a4cbada9dd9875ad8ea501b7205eba2`. Producción: rama `main`, environment `production`, tag
  `9e2abb449f50892b9f496e1b2be11f1387e599db` (imagen Vue que corría antes del corte).
- **Ojo:** un push a `develop`/`main` de erasFront vuelve a desplegar Vue encima. Ese workflow está **desactivado**
  desde 2026-10-27.

## Pruebas reales en staging (2026-10-27, cuenta admin, solo elementos de prueba creados y borrados)
Mazo (crear, actualizar, PDF de proxies, borrar), roles (crear, editar permisos, borrar), notas de partidas (crear,
editar, borrar), datos de referencia (crear, revisar uso, borrar) y lectura de usuarios, permisos, cambios pendientes,
tierlist, metadatos y partidas: todo correcto. Detalle en `PARIDAD.md`. No se tocaron datos reales (cuentas, cambios de
Drive, ediciones, tierlist, Home).

## Rediseño y login obligatorio (PRs #11–#14, 2026-10-27)
- **Login obligatorio** en todo el sitio (guard en el shell; login/registro/validación públicos, vuelve a `?returnUrl=`).
  El backend acompaña: DriveManager exige JWT en todas las consultas (DriveManager#10; solo `/api/drive/health`,
  el webhook de Drive y `/ws` quedan abiertos). El deploy verifica DriveManager con `/api/drive/health`, que hace ping a
  MongoDB (infra#5).
- **Modo edición** global: interruptor en el navbar para quien tiene `manage_home`/`manage_editions`/`manage_cards`;
  los controles de edición (Home, Ediciones, Tierlist, detalle de carta) solo se ven con el modo activo.
- **Diseño:** navbar nuevo (isotipo, iconos, menú de cuenta, franja de modo edición), favicon con el isotipo, Home en una
  pantalla, login/registro con portada, Admin agrupado, filtros de cartas en bloques (`eras-toggle-group`, sin
  sub-edición), flechas grandes en el detalle de carta, edición de ediciones en modal, mazos y tierlist como portadas
  tipo carta (`eras-deck-cover`) y filtros de mazos (nombre, autor, colores, edición, visibilidad).
- **e2e:** las páginas con datos usan sesión real con la cuenta de prueba de staging (`e2e/.auth.local.json`); sin
  cuenta (producción) solo corren los casos sin datos.

## Pendiente
1. ~~Desplegar el rediseño a producción~~ — hecho (2026-10-27): front run 40616811405 (`eras-web:5f45fc5…-prod`), backend
   DriveManager#11 run 40616913632 (`drive-manager:fcc84d2…`). Verificado: `/api/drive/health` 200, consultas sin sesión
   403, login 400 (validación), e2e en producción 9 pasan y 6 se saltan (necesitan cuenta de prueba, no hay en producción).
   Rollback del backend: Run workflow en DriveManager (`main`, `production`, tag `c00911f2de1ea27f04bfb78ecc973cd076f3f9f4`);
   del front: Run workflow en eras-web (`production`, tag `ff3221169b4e86e0b5abb288962c97a531900b6e`).
2. ~~Desactivar el CI/CD de erasFront~~ — hecho (2026-10-27, `disabled_manually`). Para un rollback a Vue hay que
   reactivarlo primero (erasFront → Actions → CI/CD → *Enable workflow*). Archivar el repo cuando ya no haga falta.
3. Opcionales: e2e en CI, Storybook, endpoint "mi cuenta", SMTP (Brevo) y orden del registro, quitar `next`.

## Cómo trabajar en el repo
```bash
npm ci
npm start                 # ng serve, proxy de /api y /ws a staging (proxy.conf.json)
npm run lint              # incluye eslint-plugin-boundaries (capas)
npm test                  # Vitest vía ng test (no usar vitest directo)
npm run e2e               # Playwright con el Chrome del sistema; E2E_BASE_URL=<url> para un despliegue
npx ng build --configuration staging
```
- **Capas:** `core` / `data-access` / `ui` / `features` (`src/app/...`). `ui` nunca importa `data-access` ni
  `features`; las páginas no tienen estilos propios (tokens SCSS `--color-*`, `--space-*`, ...).
- **Angular 22:** standalone, signals, zoneless, OnPush, `@if/@for`, `input()/output()`, params de ruta como inputs.
- **Reglas puras con tests:** `*-rules.ts` + `*.spec.ts` en `data-access` (83 tests).
- **Simulador:** mismo protocolo que Vue (`/ws`, `/topic/room/{id}`, `/app/room/{id}/action`); store en
  `data-access/simulator/game.store.ts`; tablero en `features/simulator/board/`.

## CI/CD y flujo por bloque
- `.github/workflows/ci-cd.yml`: lint-test → build → deploy-next (solo `main`), con el workflow reutilizable
  `eras-tcg/infra/.github/workflows/deploy.yml@main` en el runner self-hosted `eras-vps`.
  Imagen `ghcr.io/eras-tcg/eras-web:<sha>-next`, contenedor `eras-web-next`, puerto 3002, vhost `nginx/next.erastcg.com`.
- Flujo usado por bloque: `bash scripts/pr-flow.sh <rama> "<título>" <archivo-body.md>` → push a rama, PR, espera
  CI, merge, espera el deploy de `main`. Luego verificar en https://next.erastcg.com (o con el e2e remoto).
- Commits con `git -c user.name="CapitanPio" -c user.email="cespinoza.marinao@gmail.com"`.

## Avisos operativos
- Usar siempre `env -u GH_TOKEN gh ...`: la variable `GH_TOKEN` del equipo es de otra cuenta y no debe usarse.
- SSH al VPS: `C:\Windows\System32\OpenSSH\ssh.exe eras-vps` (usuario `claudio`, sudo sin contraseña) desde PowerShell.
- DNS de `erastcg.com` en DonWeb (lo edita el dueño).
- Verificar las cuentas de prueba de staging (en el VPS; marca `verified` sin pasar por el correo):
  ```bash
  uri=$(sudo grep -E '^SPRING_MONGODB_URI=' /etc/users-service-staging/.env | cut -d= -f2-); sudo docker run --rm -e U="$uri" mongo:7 sh -c 'mongosh "$U" --quiet --eval "printjson(db.getCollectionNames().map(c => [c, db.getCollection(c).updateMany({username: /^e2e_p[12]_71a21f$/}, {\$set: {verified: true}, \$unset: {verificationToken: 1}}).modifiedCount]))"'
  ```
- Los tests de UI con sesión usan una sesión falsa en `localStorage` (`auth_token`, `auth_user`) y respuestas
  simuladas (`e2e/fixtures.ts`); nunca crear cuentas ni escribir con credenciales reales sin permiso.
