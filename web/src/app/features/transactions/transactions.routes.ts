import type { Routes } from '@angular/router'

export default [
  {
    path: '',
    title: 'title.transactions',
    loadComponent: async () =>
      import('./pages/transactions-page/transactions-page').then((m) => m.TransactionsPage),
  },
  {
    // Shared activity (docs/features/shared-activity.md), from the tab's ⋮ menu.
    path: 'activity',
    title: 'title.activity',
    loadComponent: async () =>
      import('./pages/activity-page/activity-page').then((m) => m.ActivityPage),
  },
] satisfies Routes
