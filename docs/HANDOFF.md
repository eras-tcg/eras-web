# Handoff — migración del front ERAS (Vue → Angular)

Documento para retomar el trabajo. Plan completo: [`PLAN_MIGRACION_FRONT_ANGULAR.md`](PLAN_MIGRACION_FRONT_ANGULAR.md)
(sección 9 = estado detallado por fase). Paridad por ruta: [`PARIDAD.md`](PARIDAD.md).

**Actualizado:** 2026-10-27 · **Último PR:** #9 · **Despliegues:** https://staging.erastcg.com (**Angular**),
https://next.erastcg.com (Angular), https://erastcg.com (producción, **todavía Vue**)

## Estado en una línea
Fases 0–6 terminadas; **staging ya sirve Angular** (corte de staging hecho, e2e 15/15 en staging); pruebas reales con
la cuenta admin y partida real de 2 jugadores hechas; falta el corte de producción.

| Fase | Estado | PR |
|---|---|---|
| 0. Fundaciones (repo, CI/CD, lint de capas, Vitest, `next`) | ✓ (Storybook pospuesto) | inicial |
| 1. Sistema de diseño (tokens, temas, componentes `ui`) | ✓ (sin Storybook) | inicial |
| 2. Home, Cards, Editions | ✓ | `985f0bb`, `a58696e` |
| 3. Register, Validate, Profile | ✓ | `0db036e` |
| 4. Mazos + BoosterResult | ✓ | `932880f`, `adc7171` |
| 5. Administración + metadatos de cartas | ✓ | #1, #2 |
| 6. Simulador (STOMP) | ✓ (partida real de 2 jugadores pendiente) | #3 |
| 7. Corte | e2e + PARIDAD.md (#4); imágenes staging/prod y entornos (#7); **staging cortado**; producción pendiente | #4, #7 |

## Corte: cómo está armado
- Cada push a `main` publica `ghcr.io/eras-tcg/eras-web:<sha>-next|-staging|-prod` y despliega solo a `next`.
- **Run workflow** (eras-web → CI/CD) con `environment` = `next` | `staging` | `production` e `image_tag` = sha.
  Para staging/production despliega como servicio `eras-frontend` (mismos contenedores, puertos y vhosts que erasFront).
  `production` exige la aprobación de CapitanPio en Actions (*Review deployments*).
- **Rollback:** Run workflow en `eras-tcg/erasFront` (CI/CD) con la imagen Vue. Staging: rama `develop`, environment
  `staging`, tag `0d010c9d8a4cbada9dd9875ad8ea501b7205eba2`. Producción: rama `main`, environment `production`, tag
  `9e2abb449f50892b9f496e1b2be11f1387e599db` (imagen Vue que corría antes del corte).
- **Ojo:** un push a `develop`/`main` de erasFront vuelve a desplegar Vue encima. Al cortar producción, desactivar ese
  workflow (`gh workflow disable ci-cd.yml -R eras-tcg/erasFront`) y archivar el repo cuando ya no haga falta.

## Pruebas reales en staging (2026-10-27, cuenta admin, solo elementos de prueba creados y borrados)
Mazo (crear, actualizar, PDF de proxies, borrar), roles (crear, editar permisos, borrar), notas de partidas (crear,
editar, borrar), datos de referencia (crear, revisar uso, borrar) y lectura de usuarios, permisos, cambios pendientes,
tierlist, metadatos y partidas: todo correcto. Detalle en `PARIDAD.md`. No se tocaron datos reales (cuentas, cambios de
Drive, ediciones, tierlist, Home).

## Pendiente
1. ~~Partida real de 2 jugadores~~ — hecha (2026-10-27): `E2E_BASE_URL=https://staging.erastcg.com npx playwright test
   simulator-2p` en verde con las cuentas de prueba `e2e_p1_71a21f` / `e2e_p2_71a21f` (verificadas a mano en Mongo;
   contraseñas en `e2e/.auth.local.json`, git-ignorado).
2. **Corte de producción:** Run workflow `production` con el último sha de `main` + aprobación; verificar con
   `E2E_BASE_URL=https://erastcg.com npm run e2e`; desactivar el workflow de erasFront.
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
