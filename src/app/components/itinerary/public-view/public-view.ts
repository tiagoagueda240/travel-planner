import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { combineLatest, filter, map, switchMap } from 'rxjs';
import { City, Country, Itinerary, Place } from '../../../models/models';
import { FirebaseService } from '../../../services/firebase';

interface GroupedDay {
  dayNumber: number;
  dateLabel: string;
  places: Place[];
}

interface GroupedCity {
  city: City;
  places: Place[];
}

interface GroupedCountry {
  country: Country;
  cities: GroupedCity[];
}

@Component({
  selector: 'app-public-view',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-view.html',
  styleUrls: ['./public-view.scss'],
})
export class PublicViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly firebase = inject(FirebaseService);
  private readonly destroyRef = inject(DestroyRef);

  itinerary: Itinerary | null = null;
  notFound = false;
  loading = true;

  days: GroupedDay[] = [];
  wishlistGroups: GroupedCountry[] = [];
  activeTab: 'dias' | 'lista' = 'dias';

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('token') ?? ''),
        filter((token) => !!token),
        switchMap((token) => this.firebase.getItineraryByShareToken(token)),
        switchMap((itinerary) => {
          if (!itinerary?.id) {
            this.notFound = true;
            this.loading = false;
            return [];
          }
          this.itinerary = itinerary;
          return combineLatest([
            this.firebase.getCountriesByItinerary(itinerary.id),
            this.firebase.getCitiesByItinerary(itinerary.id),
            this.firebase.getPlacesByItinerary(itinerary.id),
          ]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([countries, cities, places]) => {
        this.loading = false;
        this.buildView(countries, cities, places);
      });
  }

  private buildView(countries: Country[], cities: City[], places: Place[]): void {
    const itinerary = this.itinerary!;
    const startDate = itinerary.startDate;
    const endDate = itinerary.endDate;

    let totalDays = 0;
    let startObj: Date | null = null;

    if (startDate && endDate) {
      startObj = new Date(startDate);
      const endObj = new Date(endDate);
      const diffTime = endObj.getTime() - startObj.getTime();
      if (diffTime >= 0) totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    const assigned = places.filter((p) => p.assignedDay);
    const maxDay = Math.max(...assigned.map((p) => p.assignedDay!), totalDays, 0);

    this.days = Array.from({ length: maxDay }, (_, i) => {
      let dateLabel = '';
      if (startObj) {
        const d = new Date(startObj);
        d.setDate(startObj.getDate() + i);
        dateLabel = new Intl.DateTimeFormat('pt-PT', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
        }).format(d);
        dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
      }
      return {
        dayNumber: i + 1,
        dateLabel,
        places: places.filter((p) => p.assignedDay === i + 1),
      };
    });

    const wishlist = places.filter((p) => !p.assignedDay);
    this.wishlistGroups = countries
      .map((country) => ({
        country,
        cities: cities
          .filter((c) => c.countryId === country.id)
          .map((city) => ({
            city,
            places: wishlist.filter((p) => p.cityId === city.id),
          }))
          .filter((gc) => gc.places.length > 0),
      }))
      .filter((gc) => gc.cities.length > 0);
  }
}
