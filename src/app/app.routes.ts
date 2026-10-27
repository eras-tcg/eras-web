import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guards';
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
