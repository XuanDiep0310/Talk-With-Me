import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'scenarios' },
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
