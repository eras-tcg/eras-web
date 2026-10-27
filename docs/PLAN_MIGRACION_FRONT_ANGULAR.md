# Plan: migrar el frontend de ERAS de Vue a Angular

Fecha: 2026-10-27. Alcance: reemplazar `eras-tcg/erasFront` (Vue 3) por una aplicación Angular con
componentes reutilizables y **tres capas separadas: diseño, arquitectura y estilos**. El backend
(DriveManager, UsersService) **no cambia**: misma API, mismo JWT, mismo WebSocket.

---

## 1. Punto de partida (diagnóstico del front actual)

| Aspecto | Hoy |
|---|---|
| Tamaño | ~22.300 líneas en 50 archivos `.vue` + 7 stores + 4 composables |
| Reparto | **8.470 líneas de CSS** (38 %), 6.210 de template, 6.460 de lógica |
| Estilos | Bootstrap 5 + bootstrap-icons + 47 bloques `<style scoped>` por archivo; 17 variables CSS de tema en `main.css` (light/dark con `data-theme`) |
| Componentes compartidos | Solo 4 fuera del simulador (`Navbar`, `CardDetailModal`, `DeckPicker`, `ProxyPrintModal`); 28 archivos implementan su propio modal |
| Páginas gigantes | `Cards.vue` 2.531 líneas, `DeckBuilder.vue` 1.725, `Ruling.vue` 1.276, `GamesManager.vue` 1.251 |
| Datos | 57 llamadas `axios` repartidas dentro de páginas (no hay capa de servicios); 7 stores Pinia |
| Permisos | `can(permission)` en el store de login, usado 28 veces en templates |
| Tiempo real | Simulador: STOMP sobre WebSocket (`store/game.js`), 22 componentes, drag & drop en 15 archivos, 4 composables de estado |
| Dependencias | `@stomp/stompjs`, `axios`, `bootstrap`, `sweetalert2`, `@vueform/multiselect`; `jspdf` y `vue-multiselect` aparecen sin uso |

**Problemas a resolver con la migración:** estilos duplicados por página, sin sistema de diseño,
lógica de negocio y llamadas HTTP mezcladas con la vista, componentes enormes difíciles de cambiar.

---

## 2. Arquitectura objetivo

### 2.1 Principios
1. **Componentes de presentación sin lógica de negocio** (reciben `input()`, emiten `output()`).
2. **Páginas (contenedores) sin estilos propios**: solo componen componentes del sistema de diseño.
3. **Datos solo en servicios/stores**: ningún componente llama HTTP directamente.
4. **Estilos solo con tokens**: ningún color, tamaño o sombra escrito a mano fuera de la capa de tokens.
5. **Dependencias en una sola dirección** (verificado por lint):
   `features → data-access → core` y `features → ui → tokens`; `ui` nunca importa `data-access` ni `features`.

### 2.2 Stack
| Tema | Elección | Por qué |
|---|---|---|
| Framework | Angular estable más reciente, **standalone components**, **signals**, control flow `@if/@for`, zoneless | Moderno, sin NgModules, reactividad simple |
| Estado | Servicios con `signal()` / `computed()`; `@ngrx/signals` (SignalStore) solo para simulador y deck builder | Simple donde basta, estructurado donde hay estado complejo |
| HTTP | `HttpClient` + interceptores (JWT, errores) | Reemplaza axios |
| UI base | **Angular CDK** (overlay, dialog, a11y, drag-drop, virtual scroll) sin estilos | Comportamiento accesible sin imponer diseño |
| Estilos | SCSS + **CSS custom properties** (tokens) con `@layer`; **sin Bootstrap** | Diseño 100 % propio y themable |
| Iconos | Bootstrap Icons como SVG (o Lucide) vía componente `<eras-icon>` | Un solo punto para cambiar iconografía |
| Catálogo de diseño | **Storybook** para la librería `ui` | Ver y probar componentes aislados |
| WebSocket | `@stomp/stompjs` (se mantiene) envuelto en un servicio `GameSocketService` | Mismo protocolo del backend |
| Tests | Vitest (unitarios), Playwright (e2e) | Rápidos; e2e cubre los flujos críticos |
| Lint | ESLint + `@angular-eslint` + reglas de límites entre capas | Mantener la separación con el tiempo |

### 2.3 Estructura del proyecto
```
eras-web/
  src/
    styles/                    ← CAPA DE ESTILOS
      tokens/  color.scss spacing.scss typography.scss radius.scss shadow.scss motion.scss
      themes/  light.scss dark.scss            (asignan valores a los tokens)
      base/    reset.scss typography.scss
      index.scss                               (@layer reset, tokens, theme, base, components, utilities)
    app/
      core/                    ← ARQUITECTURA (transversal)
        auth/   auth.service.ts auth.interceptor.ts auth.guard.ts permission.guard.ts has-permission.directive.ts
        http/   error.interceptor.ts api-config.ts
        theme/  theme.service.ts
        layout/ shell.component.ts (navbar + outlet)
      data-access/             ← ARQUITECTURA (datos por dominio: modelos + API + estado)
        cards/ decks/ editions/ users/ roles/ permissions/ games/ tierlist/ staged/ home/ simulator/
          *.model.ts  *.api.ts  *.store.ts
      ui/                      ← DISEÑO (sistema de diseño, sin lógica de negocio)
        primitives/  button input select multiselect checkbox toggle textarea icon badge chip spinner
        surfaces/    card panel modal drawer tabs accordion tooltip toast confirm-dialog
        data/        data-table paginator filter-bar empty-state
        layout/      page stack grid toolbar section-header
        domain/      card-tile card-image card-detail deck-tile edition-tile rarity-badge color-pip cost-badge
      features/                ← ARQUITECTURA (páginas; solo composición)
        home/ editions/ cards/ decks/ auth/ profile/ admin/ simulator/
      app.routes.ts            (rutas con lazy loading por feature)
```

### 2.4 Cómo se separan diseño, arquitectura y estilos
| Capa | Contiene | Cambiar esto **no** toca |
|---|---|---|
| **Estilos** (`styles/`) | Tokens y temas: colores, tipografía, espacios, radios, sombras, animaciones | Componentes ni lógica. Un tema nuevo = un archivo en `themes/` |
| **Diseño** (`ui/`) | Componentes visuales reutilizables; usan solo tokens; API por `input()/output()` | Datos ni rutas. Un rediseño del botón cambia todos los botones |
| **Arquitectura** (`core/`, `data-access/`, `features/`) | Rutas, permisos, servicios, estado, composición de páginas | Apariencia. Cambiar un endpoint toca un solo `*.api.ts` |

Ejemplo de token y uso:
```scss
/* styles/tokens/color.scss */
:root { --color-surface: var(--theme-surface); --color-accent: var(--theme-accent); }
/* styles/themes/dark.scss */
[data-theme='dark'] { --theme-surface: #1b1d24; --theme-accent: #7aa2ff; }
/* ui/primitives/button.component.scss */
:host { background: var(--color-accent); border-radius: var(--radius-md); padding: var(--space-2) var(--space-4); }
```

---

## 3. Inventario de componentes reutilizables (extraídos del front actual)

| Componente `ui` | Reemplaza | Usado en |
|---|---|---|
| `modal` / `confirm-dialog` (CDK Dialog) | 28 modales hechos a mano + SweetAlert2 | Casi todas las páginas |
| `data-table` + `paginator` + `filter-bar` | Tablas y filtros de admin | Users, Roles, Permissions, Updates, Games, CardRef |
| `multiselect` | `@vueform/multiselect` | Filtros de Cards, DeckBuilder |
| `tabs`, `accordion` | Pestañas ad hoc | Cards, Ruling, Editions |
| `toast` | `alert.js` | Global |
| `card-tile`, `card-image`, `card-detail` | Rejillas y `CardDetailModal` | Cards, DeckBuilder, Booster, Simulator |
| `deck-tile`, `deck-picker` | `DeckPicker`, listas de mazos | MyDecks, PublicDecks, Simulator |
| `edition-tile` | Tarjetas de edición | Home, Editions |
| `rarity-badge`, `color-pip`, `cost-badge` | Estilos repetidos de rareza/color | Cards, DeckBuilder, Booster |
| `page`, `toolbar`, `section-header`, `empty-state` | Cabeceras y estados vacíos repetidos | Todas |
| `shell` (navbar responsive + tema) | `Navbar.vue` | Global |

Simulador (feature propia, compone `ui` + CDK drag-drop): `board`, `player-half`, `zone` (genérica para
mano/campo/tributo/descarte/mazo), `card-token`, `life-stack`, `counter`, `targeting-overlay`, `game-log`.
Las 22 piezas actuales se reducen agrupando zonas casi idénticas en un único `zone` configurable.

---

## 4. Estrategia de migración

**Reescritura en paralelo en un repo nuevo, con corte por dominio cuando haya paridad** (no conversión
archivo por archivo, no convivencia Vue + Angular en la misma app):

- Repo nuevo **`eras-tcg/eras-web`** con el mismo CI/CD (`ci-cd.yml` + `infra/deploy.yml`).
- Se despliega en **`next.erastcg.com`** (o `staging.erastcg.com/next`) contra el **backend de staging**.
- El front Vue queda en **modo mantenimiento** (solo arreglos) hasta el corte.
- Corte final: el contenedor `eras-frontend-prod` pasa a servir la imagen Angular; rollback = volver a la
  imagen Vue con *Run workflow*.

Por qué: con un solo desarrollador, mantener dos frameworks en la misma app (micro-frontends) cuesta más
que la reescritura; la API no cambia, así que el riesgo se concentra en la UI y se valida en staging.

---

## 5. Fases

| Fase | Contenido | Entregable | Estimación* |
|---|---|---|---|
| **0. Fundaciones** | Repo `eras-web`, Angular CLI, lint de capas, Vitest, Playwright, Storybook; CI/CD y subdominio `next`; `core` (auth, interceptores, guards, permisos, tema, shell) | App vacía con login, navbar y tema light/dark desplegada en `next` | 1–1,5 sem |
| **1. Sistema de diseño** | Tokens + temas (desde las 17 variables actuales), primitives, surfaces, data, layout en Storybook | Catálogo Storybook con ~25 componentes | 1,5–2 sem |
| **2. Páginas públicas** | Home, Editions, Cards (filtros, detalle), NotFound; `data-access` cards/editions/home | Navegación pública completa | 2 sem |
| **3. Cuenta** | Login, Register, Validate, Profile | Flujo de cuenta (verificación por correo depende de reponer el SMTP) | 0,5 sem |
| **4. Mazos** | DeckBuilder (SignalStore), MyDecks, PublicDecks, DeckView, BoosterResult, ProxyPrint | Mazos completos | 2–2,5 sem |
| **5. Administración** | Users, Roles, Permissions, CardRef, Updates (staged), Games, Tierlist, Ruling sobre `data-table`/`modal` | Panel admin | 2 sem |
| **6. Simulador** | `GameSocketService` (STOMP), SignalStore de partida, board/zonas con CDK drag-drop, modales del juego, log y reconexión | Simulador con paridad | 2,5–3 sem |
| **7. Corte** | Checklist de paridad, e2e de flujos críticos, prueba en staging, corte en producción, archivar `erasFront` | Angular en producción | 0,5 sem |

\* Semanas de trabajo de una persona; total aproximado **12–14 semanas**. Las fases 2–5 pueden
reordenarse; el simulador va al final por ser lo más complejo y lo menos usado por visitantes.

### Criterios de "terminado" por página
- Paridad funcional con la versión Vue (checklist por página).
- Sin estilos propios en la página (solo componentes `ui` y utilidades de layout).
- Datos vía `data-access`; permisos vía guard/directiva.
- Responsive (móvil y escritorio) y ambos temas.
- Test unitario del store/servicio y, en flujos críticos, e2e.

---

## 6. CI/CD y despliegue
- `eras-web` reutiliza el workflow reutilizable de `infra`: imagen `ghcr.io/eras-tcg/eras-web:<sha>-<env>`,
  servida por nginx igual que hoy (config por entorno con los mismos `location /api/...` y `/ws`).
- Checks obligatorios: `lint`, `test`, `build`; Storybook se publica como artefacto (opcional GitHub Pages).
- Entorno temporal `next` (vhost `next.erastcg.com` + certificado) apuntando al backend de staging.
- Al cortar: `deploy.sh` usa la imagen `eras-web` para `eras-frontend-prod`/`-staging`; se elimina `next`.

## 7. Riesgos y mitigación
| Riesgo | Mitigación |
|---|---|
| Paridad incompleta en páginas grandes (Cards, DeckBuilder) | Checklist por página y e2e antes del corte; mantener Vue hasta paridad |
| Simulador (tiempo real, drag & drop) | Fase dedicada al final; prueba con 2 navegadores en staging; mismo protocolo STOMP |
| Rediseño visual sin dirección | Definir tokens y 3–4 pantallas clave primero (Home, Cards, DeckBuilder, Board) antes de construir en masa |
| Dos fronts en paralelo | Vue solo recibe arreglos; nuevas funciones se hacen en Angular |
| Registro sin correo | Independiente de la migración: reponer SMTP (Brevo) antes de la Fase 3 en producción |

## 8. Decisiones abiertas (para ti)
1. **Nombre del repo / subdominio**: propuesto `eras-tcg/eras-web` y `next.erastcg.com`.
2. **Dirección visual**: mantener la estética actual con tokens (más rápido) o rediseñar (requiere 3–4 maquetas primero).
3. **Iconos**: seguir con Bootstrap Icons (SVG) o pasar a Lucide.
4. **SSR / SEO**: no es necesario hoy (sitio detrás de login salvo páginas públicas); se puede agregar después con Angular SSR para Home/Editions/Cards.
5. **Storybook público** en GitHub Pages o solo local.

## 9. Estado (2026-10-27)
- **Hecho (local en `ERAS/eras-web`, git inicializado, sin remoto todavía):** tokens + temas light/dark, `core`
  (auth, interceptor, guards, `can`, tema, shell, navegación a páginas legacy), corte vertical **Editions**
  (data-access + página + formulario + simulador de sobres), login, NotFound, ~20 componentes `ui`.
- **Fase 0 cerrada en código:** lint de capas con `eslint-plugin-boundaries` (verificado con una violación
  forzada), Vitest con specs de `edition-rules` y `jwt`, `Dockerfile` + `nginx.next.conf` (build
  `--configuration staging`), vhost `nginx/next.erastcg.com`, workflow `.github/workflows/ci-cd.yml`
  (lint → test → build → deploy a `next`).
- **Desplegado:** repo `eras-tcg/eras-web` (público), entorno GitHub `next` (solo `main`), DNS A `next` en DonWeb,
  certificado Let's Encrypt, infra#4 mergeado (`deploy.sh`, `deploy.yml`, `eras-nginx-apply` aceptan `eras-web`/`next`,
  puerto 3002). **https://next.erastcg.com** sirve la app Angular contra el backend de staging.
- **Pendiente de Fase 0:** Storybook (pospuesto), Playwright e2e.
- **Fase 2 (`985f0bb`, `a58696e`, desplegados en next):** **Home** (edición y 6 mazos destacados, noticias,
  modo edición con borrador para `manage_home`) y **Cards** (todos los filtros, orden, colapsar repetidas, tamaño,
  render incremental, diálogo de detalle con navegación por grilla e impresiones, `?edition=` sincronizado).
  Editions y Home ya enlazan a `/cards`. Nuevos `ui`: featured-edition, deck-tile, news-card, split, choice-dialog,
  card-image, card-thumb, card-detail, color-pip, range-slider, multiselect, in-view.
- **Diferencias deliberadas con Vue:** efectos como segmentos de texto (sin `v-html`); keywords parametrizados
  (`"Provocar {nivel}"`) ahora sí muestran descripción y filtran; elegir edición en modo edición de Home la
  selecciona (en Vue navegaba a Cards).
- **Quedó en Vue por ahora:** edición de metadatos de cartas (formulario, editor de efectos, borrar, asignar
  imagen, lista de metadatos) → enlazada desde el detalle para `manage_cards`; va con la Fase 5 (admin).
- **Sin verificar:** modo edición de Home y acciones con `manage_*` (requieren login con permisos).
- **Fase 3 (`0db036e`, desplegada en next):** **Register** (errores por campo del servidor, traducidos; no inicia
  sesión), **Validate** (`/validate?token=`, misma ruta que el correo) y **Profile** (cambio de contraseña para
  todos; usuario/correo editables solo con `manage_users`). Login enlaza a `/register`; el usuario del shell
  enlaza a `/profile` (protegido con `authGuard`).
- **Limitaciones del backend (sin cambiarlo):** `GET /api/users` y `PUT /api/users/update/{id}` exigen
  `manage_users`, así que un usuario normal no puede ver ni cambiar su usuario/correo (en Vue fallaba en silencio);
  hace falta un endpoint "mi cuenta". El registro guarda el usuario antes de enviar el correo: con el SMTP caído la
  cuenta queda creada sin verificar y reintentar da "usuario ya existe".
- **Fase 4 (`932880f`, desplegada en next):** **PublicDecks** (`/public-decks`), **MyDecks** (`/my-decks`, `authGuard`, borrar con
  confirmación), **DeckView** (`/deck/:id`, por tipo, detalle de carta, proxies, editar si es tuyo, copiar) y
  **DeckBuilder** (`/deck-builder?id=&copy=`): búsqueda con los filtros de Cartas en diálogo, agregar con +/clic
  derecho/arrastrar, 4 copias por nombre y 100 cartas, portada, privado, métricas filtrables, exportar/importar
  `.txt` (mismo formato que Vue), proxies PDF, guardar/descartar, aviso al salir con cambios. Un mazo ajeno se abre
  como copia. Home enlaza a `/deck/:id`.
- **Desviación:** el borrador del builder usa un servicio con signals acotado al componente, no `@ngrx/signals`
  (no hizo falta la dependencia).
- **BoosterResult (`adc7171`, desplegado en next):** `/booster-result?edition=&mode=pack|box&packType=&random=` (misma URL que
  Vue), "Volver a abrir" sin recargar, detalle de carta. Editions → "Simular apertura" ya navega aquí. **Fase 4 cerrada.**
- **Sin verificar (Fase 4):** guardar, borrar y descargar PDF reales (requieren sesión con `manage_decks` / descarga).
- **Fase 5 (PR #1 y #2, desplegada en next):** hub `/admin` (herramientas según permisos, enlazado desde la
  barra), **Usuarios** (`/users-manager`), **Roles** (`/roles`), **Permisos** (`/permissions`), **Gestionar cambios**
  (`/updates-manager`), **Datos de referencia** (`/card-ref`, con editor de efectos compartido), **Registro de
  partidas** (`/games-manager`), **Tierlist** (`/tierlist`) y **Cómo jugar** (`/ruling`, ahora en el menú). Mismas
  rutas que Vue. Nuevos `ui`: table, tabs, confirm-dialog (en todos los borrados), tier-row, deck-chip, gem-track,
  playmat, prose. Errores HTTP sin cuerpo se muestran como permiso/sesión/servidor; fechas en `es`.
- **Arreglos respecto de Vue:** Usuarios funciona sin `manage_roles`; borrar un valor de referencia exige revisar antes
  qué cartas lo usan; el editor de efectos conserva valores que ya no están en las listas (Vue los perdía al
  guardar, p. ej. `kind: "triggered"` de "Provocar"); "reemplazar" un keyword (roto en Vue) se ofrece solo como eliminar.
- **Metadatos de cartas (PR #2):** desde el detalle de carta, `manage_cards` crea/edita metadatos (todos los campos,
  efectos, keywords), renombra la imagen y borra metadatos/imagen/ambos; `/card-meta` lista metadatos sin imagen (5 en
  staging) y permite asignarles una. **Fase 5 cerrada.** **Sin verificar:** toda escritura real de administración (requiere sesión con los
  permisos); la UI se probó con sesión simulada y respuestas simuladas.
- **Fase 6 (PR #3, desplegada en next):** **Simulador** con el mismo protocolo STOMP que Vue (`/ws`, `/topic/room/{id}`,
  `/app/room/{id}/action`, mismos tipos de acción). `/simulator` (lobby: crear sala, elegir mazo propio o público,
  copiar enlace, reconectar si ya estás en la sala), `/simulator/:roomId` y `/simulator/:roomId/board` (aviso al salir).
  Tablero: vidas, mano (invocación por efecto), campo con posiciones en %, interacción con criaturas cercanas
  (materiales/adjuntos), mazo (robar, ver arriba/abajo, tope a zonas, barajar, descarte/tributos al fondo), tributos,
  fondo del mazo, descarte, barra compartida, objetivos (Esc cancela), cartas reveladas, historial, ver mi mazo,
  paneles de estado (espera, primer jugador, mulligan, fin de partida/revancha), rival desconectado, rendirse.
  Nuevos `ui`: menu (CDK Menu), game-card, game-zone, resource-pips, shared-bar. Reglas puras con tests en
  `game-rules`. Arrastrar con HTML5 DnD nativo (no CDK drag-drop: el campo usa coordenadas libres y destinos de varias zonas).
- **Sin verificar (Fase 6):** partida real de 2 jugadores por WebSocket (requiere dos sesiones reales); la UI se probó
  con estado simulado inyectado en el store.
- **Fase 7, preparación (PR #4, desplegada en next):** Playwright (`npm run e2e`, 14 casos: home, cartas, ediciones/sobres,
  mazos públicos y vista, constructor con aviso al salir, guards, 404, enlaces antiguos, login/salir, login fallido,
  mis mazos, lobby del simulador, permisos). Corre local (`ng serve`) o contra un despliegue
  (`E2E_BASE_URL=https://next.erastcg.com npm run e2e`, en verde). Checklist de paridad en `eras-web/docs/PARIDAD.md`.
  Redirecciones de los alias con mayúscula de Vue (`/Home`, `/Login`, `/Register`, `/Validate`, `/Editions`, `/Cards`).
- **CORS de staging resuelto (2026-10-27):** `CORS_ALLOWED_ORIGINS` de UsersService y DriveManager en staging incluye `https://next.erastcg.com` (respaldo `.env.bak-<fecha>` en el VPS; redeploy con *Run workflow* en `develop`, la protección del entorno staging solo admite esa rama). Login y escrituras desde next ya no reciben 403; `ng serve` (origen localhost) sigue rechazado y el e2e "CORS" lo marca como fallo esperado solo en local.
- **Pendiente para el corte (no hecho a propósito):** escrituras reales con permisos, partida real de 2 jugadores,
  corte de `eras-frontend-prod` a la imagen `eras-web` y archivar `Eras`; además endpoint "mi cuenta", SMTP,
  Storybook y e2e en CI.

## 10. Próximo paso
Ver `docs/HANDOFF.md` en `eras-tcg/eras-web` (estado actual, bloqueantes y orden de trabajo).
