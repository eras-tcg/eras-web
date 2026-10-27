# Handoff — migración del front ERAS (Vue → Angular)

Documento para retomar el trabajo. Plan completo: [`PLAN_MIGRACION_FRONT_ANGULAR.md`](PLAN_MIGRACION_FRONT_ANGULAR.md)
(sección 9 = estado detallado por fase). Paridad por ruta: [`PARIDAD.md`](PARIDAD.md).

**Fecha de pausa:** 2026-10-27 · **Último PR:** #6 · **Despliegue:** https://next.erastcg.com (backend de staging)

## Estado en una línea
Fases 0–6 terminadas y desplegadas en `next`; Fase 7 (corte) preparada (e2e + checklist); falta probar con cuentas
reales (CORS de next ya resuelto). Producción sigue en Vue.

| Fase | Estado | PR |
|---|---|---|
| 0. Fundaciones (repo, CI/CD, lint de capas, Vitest, `next`) | ✓ (Storybook pospuesto) | inicial |
| 1. Sistema de diseño (tokens, temas, componentes `ui`) | ✓ (sin Storybook) | inicial |
| 2. Home, Cards, Editions | ✓ | `985f0bb`, `a58696e` |
| 3. Register, Validate, Profile | ✓ | `0db036e` |
| 4. Mazos + BoosterResult | ✓ | `932880f`, `adc7171` |
| 5. Administración + metadatos de cartas | ✓ | #1, #2 |
| 6. Simulador (STOMP) | ✓ (sin partida real de 2 jugadores) | #3 |
| 7. Corte | preparado: e2e (14 casos) + PARIDAD.md; **corte no hecho** | #4 |

## Bloqueantes (requieren decisión o acceso del dueño)
1. ~~CORS en `next`~~ — resuelto (2026-10-27): `CORS_ALLOWED_ORIGINS` de UsersService y DriveManager en staging incluye `https://next.erastcg.com` (respaldo `.env.bak-<fecha>` en el VPS; redeploy con *Run workflow* en `develop`, la protección del entorno staging solo admite esa rama). Login y escrituras desde next ya no reciben 403; `ng serve` (origen localhost) sigue rechazado y el e2e "CORS" lo marca como fallo esperado solo en local.
2. **Pruebas con cuenta real** (staging, con permisos): login, guardar/borrar mazo, PDF de proxies, todas las
   herramientas de admin, edición de Home/ediciones/metadatos. Hasta hoy solo se probaron con sesión y respuestas simuladas.
3. **Partida real de 2 jugadores** en el simulador (dos navegadores/cuentas) en staging.

## Siguiente trabajo, en orden
1. ~~Resolver CORS~~ hecho; `E2E_BASE_URL=https://next.erastcg.com npm run e2e` en verde (14/14).
2. Recorrer `PARIDAD.md` con una cuenta real: marcar cada fila "simulada" como probada o abrir arreglos.
3. Partida real en el simulador; arreglar lo que aparezca.
4. Corte (Fase 7): `eras-frontend-staging` y luego `eras-frontend-prod` pasan a la imagen `eras-web`
   (`infra/deploy.sh` + `deploy.yml`); rollback = volver a la imagen Vue con *Run workflow*. Quitar el entorno `next`
   y archivar el repo Vue (`Eras`). **No hacerlo sin confirmación del dueño.**
5. Opcionales: e2e en CI (instalar navegador de Playwright en el runner `eras-vps`), Storybook, endpoint "mi cuenta"
   en UsersService, SMTP (Brevo) y orden del registro.

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
- Los tests de UI con sesión usan una sesión falsa en `localStorage` (`auth_token`, `auth_user`) y respuestas
  simuladas (`e2e/fixtures.ts`); nunca crear cuentas ni escribir con credenciales reales sin permiso.
