import { inject } from '@angular/core';
import { CanDeactivateFn, Routes } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import type { AdminEditorComponent } from './admin-editor.component';

const confirmUnsavedChanges: CanDeactivateFn<AdminEditorComponent> = (editor) =>
  !inject(AuthService).isAuthenticated() || !editor.hasUnsavedChanges() ||
  window.confirm('Bạn có thay đổi chưa lưu. Rời trình soạn bài?');

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
        canDeactivate: [confirmUnsavedChanges],
        loadComponent: () => import('./admin-editor.component').then((m) => m.AdminEditorComponent)
      },
      {
        path: 'scenarios/:id',
        canDeactivate: [confirmUnsavedChanges],
        loadComponent: () => import('./admin-editor.component').then((m) => m.AdminEditorComponent)
      },
      {
        path: 'coach-topics',
        loadComponent: () => import('./admin-coach-topics.component').then((m) => m.AdminCoachTopicsComponent)
      },
      { path: '**', redirectTo: 'scenarios' }
    ]
  }
];
