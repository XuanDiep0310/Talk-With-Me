import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '', pathMatch: 'full',
        loadComponent: () => import('./admin-overview.component').then((m) => m.AdminOverviewComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./admin-users.component').then((m) => m.AdminUsersComponent)
      },
      {
        path: 'categories',
        loadComponent: () => import('./admin-categories.component').then((m) => m.AdminCategoriesComponent)
      },
      {
        path: 'scenarios',
        loadComponent: () => import('./admin-scenarios.component').then((m) => m.AdminScenariosComponent)
      },
      {
        path: 'scenarios/new',
        loadComponent: () => import('./admin-editor.component').then((m) => m.AdminEditorComponent)
      },
      {
        path: 'scenarios/:id',
        loadComponent: () => import('./admin-editor.component').then((m) => m.AdminEditorComponent)
      },
      { path: '**', redirectTo: 'scenarios' }
    ]
  }
];
