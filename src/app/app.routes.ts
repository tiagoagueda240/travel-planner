import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { ItineraryBoardComponent } from './components/itinerary/board/itinerary-board';
import { ItineraryCountriesComponent } from './components/itinerary/countries/itinerary-countries';
import { PublicViewComponent } from './components/itinerary/public-view/public-view';
import { LoginComponent } from './components/login/login';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: '', component: DashboardComponent, canActivate: [authGuard] },
  {
    path: 'itinerario/:itineraryId',
    component: ItineraryCountriesComponent,
    canActivate: [authGuard],
  },
  {
    path: 'itinerario/:itineraryId/planear',
    component: ItineraryBoardComponent,
    canActivate: [authGuard],
  },
  { path: 'partilha/:token', component: PublicViewComponent },
  { path: '**', redirectTo: '' },
];
