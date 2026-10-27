import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const TABS_ROUTES: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      { path: 'home', loadComponent: () => import('../home/home.page').then((m) => m.HomePage) },
      { path: 'trips', loadComponent: () => import('../trips/trips.page').then((m) => m.TripsPage) },
      { path: 'chat', loadComponent: () => import('../chat/chat.page').then((m) => m.ChatPage) },
      { path: 'airport', loadComponent: () => import('../airport/airport.page').then((m) => m.AirportPage) },
      { path: 'profile', loadComponent: () => import('../profile/profile.page').then((m) => m.ProfilePage) },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];
