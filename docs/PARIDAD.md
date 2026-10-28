# Checklist de paridad con el front Vue (`Eras`)

Fase 7 del plan (`PLAN_MIGRACION_FRONT_ANGULAR.md`). Cada ruta de `Eras/src/routes/route.js` tiene su página en
Angular con la misma URL. Leyenda: **e2e** = cubierta por `npm run e2e`; **next** = probada en
https://next.erastcg.com; **real** = probada en staging con la cuenta admin y datos reales (2026-10-27), solo sobre
elementos de prueba creados y borrados; **simulada** = probada con sesión y respuestas simuladas.

| Ruta Vue | Angular | Lectura | Escritura / acciones | Pruebas |
|---|---|---|---|---|
| `/home` (`/`, `/Home`) | `/home` (+ redirecciones) | ✓ | edición de Home (`manage_home`): simulada | e2e, next |
| `/login` (`/Login`) | `/login` | — | login: **real** (admin); cuenta sin verificar muestra su error | e2e, real |
| `/register` (`/Register`) | `/register` | — | crea la cuenta; el correo falla (SMTP `Authentication failed`) | next (errores), real (API) |
| `/validate` (`/Validate`) | `/validate?token=` | — | verificación real sin probar | — |
| `/profile` | `/profile` | ✓ | cambio de contraseña sin probar; usuario/correo solo `manage_users` | e2e (guard) |
| `/editions` (`/Editions`) | `/editions` | ✓ | crear/editar edición: simulada | e2e, next |
| `/cards` (`/Cards`) | `/cards` | ✓ filtros, orden, detalle | metadatos (`manage_cards`): simulada | e2e, next |
| `/deck-builder` (`/DeckBuilder`) | `/deck-builder` | ✓ | guardar (crear + actualizar): **real**; exportar/importar `.txt`: local | e2e, next, real |
| `/my-decks` | `/my-decks` | **real** | borrar con confirmación: **real** | e2e, real |
| `/public-decks` | `/public-decks` | ✓ | — | e2e, next |
| `/deck/:id` | `/deck/:id` | ✓ | copiar/editar; PDF de proxies: **real** (API, 432 KB) | e2e, next, real |
| `/booster-result` | `/booster-result` | ✓ | — | e2e, next |
| `/updates-manager` | `/updates-manager` | **real** (461 pendientes) | aplicar/descartar: simulada (no se tocaron datos reales) | real (lectura) |
| `/card-ref` | `/card-ref` | **real** | crear, revisar uso y borrar valor: **real** | real |
| `/roles` | `/roles` | **real** | crear, editar permisos y borrar: **real** | real |
| `/permissions` | `/permissions` | **real** (9) | simulada | real (lectura) |
| `/users-manager` | `/users-manager` | **real** (6 cuentas) | simulada (no se editaron cuentas reales) | e2e (guard), real (lectura) |
| `/ruling` | `/ruling` | ✓ | — | next |
| `/tierlist` | `/tierlist` | **real** | simulada (no se tocó la tierlist real) | real (lectura) |
| `/games-manager` | `/games-manager` | **real** (25 partidas) | notas: crear, editar y borrar **real**; partidas: simulada | real |
| `/simulator`, `/simulator/:roomId` | iguales | simulada | crear sala: simulada | e2e (simulado) |
| `/simulator/:roomId/board` | igual | estado simulado | partida real de 2 jugadores: **real** (sala, iniciadora, mulligan, turnos, robar, rendición; 2/2 corridas) | e2e (`simulator-2p`), real |
| `/:pathMatch(.*)*` | `**` (NotFound) | ✓ | — | e2e, next |

Además: `/card-meta` (nueva, metadatos sin imagen) y `/admin` (hub de herramientas).

## Antes del corte en producción (hecho el 2026-10-27)
1. ~~Permitir escrituras desde `next`~~ (hecho) y repetir las escrituras "simuladas" con una cuenta real
   de staging con permisos: login, guardar/borrar mazo, PDF de proxies, admin (usuarios, roles, permisos, referencia,
   cambios, partidas, tierlist, Home, ediciones, metadatos).
2. Partida real de 2 jugadores en el simulador (dos navegadores) en staging.
3. `npm run e2e` contra `next` en verde (`E2E_BASE_URL=https://next.erastcg.com npm run e2e`).
4. Corte: `eras-frontend-prod`/`-staging` pasan a la imagen `eras-web`; rollback = imagen Vue con *Run workflow*.

## Pendientes conocidos
- ~~CORS en `next`~~: resuelto (2026-10-27): `CORS_ALLOWED_ORIGINS` de UsersService y DriveManager en staging incluye `https://next.erastcg.com` (respaldo `.env.bak-<fecha>` en el VPS; redeploy con *Run workflow* en `develop`, la protección del entorno staging solo admite esa rama). Login y escrituras desde next ya no reciben 403; `ng serve` (origen localhost) sigue rechazado y el e2e "CORS" lo marca como fallo esperado solo en local.
- Endpoint "mi cuenta" en UsersService (hoy usuario/correo propios exigen `manage_users`).
- SMTP (Brevo) y orden del registro (se guarda el usuario antes de enviar el correo).
- Storybook (pospuesto).
- e2e en CI: hoy se corre a mano (usa el Chrome del sistema); para CI hay que instalar el navegador de Playwright en el runner.
