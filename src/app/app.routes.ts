import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';

import { ItineraryBoardComponent } from './components/itinerary-board/itinerary-board';
import { ItineraryCountriesComponent } from './components/itinerary-countries/itinerary-countries';
import { CountryCitiesComponent } from './components/country-cities/country-cities';

export const routes: Routes = [
    { path: '', component: DashboardComponent },
    { path: 'itinerario/:itineraryId', component: ItineraryCountriesComponent },
    { path: 'itinerario/:itineraryId/pais/:countryId', component: CountryCitiesComponent },
    { path: 'itinerario/:itineraryId/pais/:countryId/cidade/:cityId', component: ItineraryBoardComponent },
    { path: '**', redirectTo: '' }
];