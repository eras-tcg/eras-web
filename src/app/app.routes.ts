import { Routes } from '@angular/router';
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
        path: '**',
        title: 'No encontrada · ERAS',
        loadComponent: () => import('@features/not-found/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
