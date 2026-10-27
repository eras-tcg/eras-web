import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from '@core/auth/auth.guards';
import { ShellComponent } from '@core/layout/shell.component';

/** Each feature is lazy-loaded. Pages not migrated yet are linked to the legacy app from the navigation. */
export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        title: 'ERAS',
        loadComponent: () => import('@features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'cards',
        title: 'Cartas · ERAS',
        loadComponent: () => import('@features/cards/cards.page').then((m) => m.CardsPage),
      },
      {
        path: 'editions',
        title: 'Ediciones · ERAS',
        loadComponent: () => import('@features/editions/editions.page').then((m) => m.EditionsPage),
      },
      {
        path: 'booster-result',
        title: 'Apertura · ERAS',
        loadComponent: () => import('@features/editions/booster-result.page').then((m) => m.BoosterResultPage),
      },
      {
        path: 'login',
        title: 'Iniciar sesión · ERAS',
        loadComponent: () => import('@features/auth/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        title: 'Crear cuenta · ERAS',
        loadComponent: () => import('@features/auth/register.page').then((m) => m.RegisterPage),
      },
      {
        // Same path as the Vue app: it is the link the verification e-mail points to
        path: 'validate',
        title: 'Validar cuenta · ERAS',
        loadComponent: () => import('@features/auth/validate.page').then((m) => m.ValidatePage),
      },
      {
        path: 'profile',
        title: 'Mi perfil · ERAS',
        canMatch: [authGuard],
        loadComponent: () => import('@features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'public-decks',
        title: 'Mazos públicos · ERAS',
        loadComponent: () => import('@features/decks/public-decks.page').then((m) => m.PublicDecksPage),
      },
      {
        path: 'my-decks',
        title: 'Mis mazos · ERAS',
        canMatch: [authGuard],
        loadComponent: () => import('@features/decks/my-decks.page').then((m) => m.MyDecksPage),
      },
      {
        path: 'deck/:id',
        title: 'Mazo · ERAS',
        loadComponent: () => import('@features/decks/deck-view.page').then((m) => m.DeckViewPage),
      },
      {
        path: 'deck-builder',
        title: 'Constructor de mazos · ERAS',
        canDeactivate: [(page: { confirmLeave?: () => Promise<boolean> }) => page.confirmLeave?.() ?? true],
        loadComponent: () => import('@features/decks/deck-builder/deck-builder.page').then((m) => m.DeckBuilderPage),
      },
      {
        path: 'admin',
        title: 'Administración · ERAS',
        canMatch: [authGuard],
        loadComponent: () => import('@features/admin/admin.page').then((m) => m.AdminPage),
      },
      {
        // Same paths as the Vue app
        path: 'users-manager',
        title: 'Usuarios · ERAS',
        canMatch: [permissionGuard('manage_users')],
        loadComponent: () => import('@features/admin/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'roles',
        title: 'Roles · ERAS',
        canMatch: [permissionGuard('manage_roles')],
        loadComponent: () => import('@features/admin/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'permissions',
        title: 'Permisos · ERAS',
        canMatch: [permissionGuard('manage_permissions', 'read_permissions')],
        loadComponent: () => import('@features/admin/permissions.page').then((m) => m.PermissionsPage),
      },
      {
        path: 'updates-manager',
        title: 'Gestionar cambios · ERAS',
        canMatch: [permissionGuard('manage_cards')],
        loadComponent: () => import('@features/admin/updates.page').then((m) => m.UpdatesPage),
      },
      {
        path: 'card-ref',
        title: 'Datos de referencia · ERAS',
        canMatch: [permissionGuard('manage_cards')],
        loadComponent: () => import('@features/admin/card-ref/card-ref.page').then((m) => m.CardRefPage),
      },
      {
        path: 'games-manager',
        title: 'Registro de partidas · ERAS',
        canMatch: [permissionGuard('manage_decks')],
        loadComponent: () => import('@features/admin/games/games.page').then((m) => m.GamesPage),
      },
      {
        path: 'tierlist',
        title: 'Tierlist · ERAS',
        canMatch: [authGuard],
        loadComponent: () => import('@features/tierlist/tierlist.page').then((m) => m.TierlistPage),
      },
      {
        path: 'ruling',
        title: 'Aprender a jugar · ERAS',
        canMatch: [authGuard],
        loadComponent: () => import('@features/ruling/ruling.page').then((m) => m.RulingPage),
      },
      {
        path: 'card-meta',
        title: 'Metadatos de cartas · ERAS',
        canMatch: [permissionGuard('manage_cards')],
        loadComponent: () => import('@features/admin/card-meta.page').then((m) => m.CardMetaPage),
      },
      {
        path: 'simulator',
        title: 'Simulador · ERAS',
        canMatch: [authGuard],
        loadComponent: () => import('@features/simulator/lobby.page').then((m) => m.LobbyPage),
      },
      {
        path: 'simulator/:roomId',
        title: 'Simulador · ERAS',
        canMatch: [authGuard],
        loadComponent: () => import('@features/simulator/lobby.page').then((m) => m.LobbyPage),
      },
      {
        path: 'simulator/:roomId/board',
        title: 'Partida · ERAS',
        canMatch: [authGuard],
        canDeactivate: [(page: { confirmLeave?: () => Promise<boolean> }) => page.confirmLeave?.() ?? true],
        loadComponent: () => import('@features/simulator/board/board.page').then((m) => m.BoardPage),
      },
      // Old capitalized links shared from the Vue app
      { path: 'DeckBuilder', redirectTo: 'deck-builder' },
      {
        path: '**',
        title: 'No encontrada · ERAS',
        loadComponent: () => import('@features/not-found/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
