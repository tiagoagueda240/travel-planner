import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: '',
    loadComponent: () =>
      import('./components/dashboard/dashboard').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'itinerario/:itineraryId',
    loadComponent: () =>
      import('./components/itinerary/countries/itinerary-countries').then(
        (m) => m.ItineraryCountriesComponent,
      ),
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'itinerario/:itineraryId/planear',
    loadComponent: () =>
      import('./components/itinerary/board/itinerary-board').then((m) => m.ItineraryBoardComponent),
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'partilha/:token',
    loadComponent: () =>
      import('./components/itinerary/public-view/public-view').then((m) => m.PublicViewComponent),
  },
  { path: '**', redirectTo: '' },
];
