# Checklist de paridad con el front Vue (`Eras`)

Fase 7 del plan (`PLAN_MIGRACION_FRONT_ANGULAR.md`). Cada ruta de `Eras/src/routes/route.js` tiene su página en
Angular con la misma URL. Leyenda: **e2e** = cubierta por `npm run e2e`; **next** = probada en
https://next.erastcg.com; **simulada** = probada con sesión y respuestas simuladas (sin escritura real).

| Ruta Vue | Angular | Lectura | Escritura / acciones | Pruebas |
|---|---|---|---|---|
| `/home` (`/`, `/Home`) | `/home` (+ redirecciones) | ✓ | edición de Home (`manage_home`): simulada | e2e, next |
| `/login` (`/Login`) | `/login` | — | login: simulado | e2e (simulado) |
| `/register` (`/Register`) | `/register` | — | depende del SMTP (ver pendientes) | next (errores) |
| `/validate` (`/Validate`) | `/validate?token=` | — | verificación real sin probar | — |
| `/profile` | `/profile` | ✓ | cambio de contraseña sin probar; usuario/correo solo `manage_users` | e2e (guard) |
| `/editions` (`/Editions`) | `/editions` | ✓ | crear/editar edición: simulada | e2e, next |
| `/cards` (`/Cards`) | `/cards` | ✓ filtros, orden, detalle | metadatos (`manage_cards`): simulada | e2e, next |
| `/deck-builder` (`/DeckBuilder`) | `/deck-builder` | ✓ | guardar: sin probar real; exportar/importar `.txt`: local | e2e, next |
| `/my-decks` | `/my-decks` | simulada | borrar: simulada | e2e (simulado) |
| `/public-decks` | `/public-decks` | ✓ | — | e2e, next |
| `/deck/:id` | `/deck/:id` | ✓ | copiar/editar; PDF de proxies sin probar real | e2e, next |
| `/booster-result` | `/booster-result` | ✓ | — | e2e, next |
| `/updates-manager` | `/updates-manager` | simulada | aplicar/descartar: simulada | — |
| `/card-ref` | `/card-ref` | simulada | crear/borrar valores: simulada | — |
| `/roles` | `/roles` | simulada | simulada | — |
| `/permissions` | `/permissions` | simulada | simulada | — |
| `/users-manager` | `/users-manager` | simulada | simulada | e2e (guard) |
| `/ruling` | `/ruling` | ✓ | — | next |
| `/tierlist` | `/tierlist` | simulada | simulada | — |
| `/games-manager` | `/games-manager` | simulada | simulada | — |
| `/simulator`, `/simulator/:roomId` | iguales | simulada | crear sala: simulada | e2e (simulado) |
| `/simulator/:roomId/board` | igual | estado simulado | partida real por WebSocket sin probar | manual (estado simulado) |
| `/:pathMatch(.*)*` | `**` (NotFound) | ✓ | — | e2e, next |

Además: `/card-meta` (nueva, metadatos sin imagen) y `/admin` (hub de herramientas).

## Antes del corte en producción
1. Permitir escrituras desde `next` (ver pendiente de CORS) y repetir las escrituras "simuladas" con una cuenta real
   de staging con permisos: login, guardar/borrar mazo, PDF de proxies, admin (usuarios, roles, permisos, referencia,
   cambios, partidas, tierlist, Home, ediciones, metadatos).
2. Partida real de 2 jugadores en el simulador (dos navegadores) en staging.
3. `npm run e2e` contra `next` en verde (`E2E_BASE_URL=https://next.erastcg.com npm run e2e`).
4. Corte: `eras-frontend-prod`/`-staging` pasan a la imagen `eras-web`; rollback = imagen Vue con *Run workflow*.

## Pendientes conocidos
- **CORS en `next` (bloquea escrituras):** el backend de staging solo admite `https://staging.erastcg.com` en
  `CORS_ALLOWED_ORIGINS`, así que todo POST/PUT/DELETE desde `next.erastcg.com` (y desde `ng serve`) recibe
  `403 Invalid CORS request`, incluido el login. Arreglo: agregar `https://next.erastcg.com` (y
  `http://localhost:4200`) a `CORS_ALLOWED_ORIGINS` de UsersService y DriveManager en staging, o quitar `Origin` en
  el proxy de `nginx.next.conf`. El test e2e "CORS" lo marca como fallo esperado hasta que se arregle.
- Endpoint "mi cuenta" en UsersService (hoy usuario/correo propios exigen `manage_users`).
- SMTP (Brevo) y orden del registro (se guarda el usuario antes de enviar el correo).
- Storybook (pospuesto).
- e2e en CI: hoy se corre a mano (usa el Chrome del sistema); para CI hay que instalar el navegador de Playwright en el runner.
