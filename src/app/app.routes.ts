import { Routes } from '@angular/router';
import { authGuard, guestGuard, welcomeGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  { path: '', redirectTo: 'welcome', pathMatch: 'full' },
  { path: 'welcome', canActivate: [welcomeGuard], loadComponent: () => import('./pages/welcome/welcome.page').then((m) => m.WelcomePage) },
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      { path: 'login', loadComponent: () => import('./pages/auth/login.page').then((m) => m.LoginPage) },
      { path: 'register', loadComponent: () => import('./pages/auth/register.page').then((m) => m.RegisterPage) },
      { path: 'forgot', loadComponent: () => import('./pages/auth/forgot.page').then((m) => m.ForgotPage) },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  { path: 'tabs', canActivate: [authGuard], loadChildren: () => import('./pages/tabs/tabs.routes').then((m) => m.TABS_ROUTES) },
  { path: 'trip/:id', canActivate: [authGuard], loadComponent: () => import('./pages/trip-detail/trip-detail.page').then((m) => m.TripDetailPage) },
  { path: 'add-flight', canActivate: [authGuard], loadComponent: () => import('./pages/add-flight/add-flight.page').then((m) => m.AddFlightPage) },
  { path: 'chat/:id', canActivate: [authGuard], loadComponent: () => import('./pages/chat-room/chat-room.page').then((m) => m.ChatRoomPage) },
  { path: 'alerts', canActivate: [authGuard], loadComponent: () => import('./pages/alerts/alerts.page').then((m) => m.AlertsPage) },
  { path: 'rights', canActivate: [authGuard], loadComponent: () => import('./pages/rights/rights.page').then((m) => m.RightsPage) },
  { path: 'settings/notifications', canActivate: [authGuard], loadComponent: () => import('./pages/settings/notification-settings.page').then((m) => m.NotificationSettingsPage) },
  { path: 'settings/security', canActivate: [authGuard], loadComponent: () => import('./pages/settings/security-settings.page').then((m) => m.SecuritySettingsPage) },
  { path: 'legal/:doc', loadComponent: () => import('./pages/legal/legal.page').then((m) => m.LegalPage) },
  { path: '**', redirectTo: 'welcome' },
];
