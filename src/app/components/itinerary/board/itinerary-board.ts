import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { combineLatest, filter, map, switchMap, tap } from 'rxjs';
import { City, Country, Itinerary, Place } from '../../../models/models';
import { FirebaseService } from '../../../services/firebase';
import { ToastService } from '../../../services/toast';
import { MapPlace, MapViewComponent } from '../../shared/map-view/map-view';
import { PlaceCardComponent } from '../../shared/place-card/place-card';
import { ShareModalComponent } from '../../shared/share-modal/share-modal';

interface GroupedCity {
  city: City;
  places: Place[];
}
interface GroupedCountry {
  country: Country;
  cities: GroupedCity[];
}

@Component({
  selector: 'app-itinerary-board',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    PlaceCardComponent,
    RouterModule,
    ShareModalComponent,
    MapViewComponent,
  ],
  templateUrl: './itinerary-board.html',
  styleUrls: ['./itinerary-board.scss'],
})
export class ItineraryBoardComponent implements OnInit {
  private readonly firebaseService = inject(FirebaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  itineraryId = '';
  itineraryName = 'A carregar...';
  startDate = '';
  endDate = '';
  itinerary: Itinerary | null = null;
  isOwner = false;
  showShareModal = false;
  showMap = false;

  allPlaces: Place[] = [];
  countries: Country[] = [];
  cities: City[] = [];

  wishlistGroups: GroupedCountry[] = [];
  days: { dayNumber: number; dateLabel: string; places: Place[] }[] = [];
  unassignZone: Place[] = [];

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('itineraryId') ?? ''),
        filter((id) => !!id),
        tap((id) => (this.itineraryId = id)),
        switchMap((id) =>
          combineLatest([
            this.firebaseService.getItinerary(id),
            this.firebaseService.getCountriesByItinerary(id),
            this.firebaseService.getCitiesByItinerary(id),
            this.firebaseService.getPlacesByItinerary(id),
          ]),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([itinerary, countries, cities, places]) => {
        if (itinerary) {
          this.itinerary = itinerary;
          this.itineraryName = itinerary.name;
          this.startDate = itinerary.startDate ?? '';
          this.endDate = itinerary.endDate ?? '';
          this.isOwner = this.firebaseService.isOwner(itinerary);
        }
        this.countries = countries;
        this.cities = cities;
        this.allPlaces = places;
        this.buildGrid();
      });
  }

  async distributeSmartly(): Promise<void> {
    const unassigned = this.allPlaces.filter((p) => !p.assignedDay);
    if (this.days.length === 0 || unassigned.length === 0) return;
    try {
      await Promise.all(
        unassigned.map((place, index) =>
          this.firebaseService.updatePlaceDay(place, (index % this.days.length) + 1),
        ),
      );
    } catch {
      this.toast.error('Erro ao distribuir os locais. Tenta novamente.');
    }
  }

  async deletePlace(place: Place): Promise<void> {
    try {
      await this.firebaseService.deletePlace(
        place.itineraryId!,
        place.countryId!,
        place.cityId,
        place.id!,
      );
    } catch {
      this.toast.error('Erro ao eliminar o local. Tenta novamente.');
    }
  }

  async unassignPlace(place: Place): Promise<void> {
    try {
      await this.firebaseService.updatePlaceDay(place, null);
    } catch {
      this.toast.error('Erro ao desapontar o local. Tenta novamente.');
    }
  }

  buildGrid(): void {
    this.unassignZone = [];

    let totalDays = 0;
    let startObj: Date | null = null;

    if (this.startDate && this.endDate) {
      startObj = new Date(this.startDate);
      const endObj = new Date(this.endDate);
      const diffTime = endObj.getTime() - startObj.getTime();
      if (diffTime >= 0) totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    const assigned = this.allPlaces.filter((p) => p.assignedDay);
    const maxAssignedDay = Math.max(...assigned.map((p) => p.assignedDay!), totalDays, 0);

    this.days = Array.from({ length: maxAssignedDay }, (_, i) => {
      let dateLabel = '';
      if (startObj) {
        const d = new Date(startObj);
        d.setDate(startObj.getDate() + i);
        dateLabel = new Intl.DateTimeFormat('pt-PT', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
        }).format(d);
      }
      return {
        dayNumber: i + 1,
        dateLabel: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
        places: [],
      };
    });

    const wishlist: Place[] = [];
    this.allPlaces.forEach((place) => {
      if (place.assignedDay && place.assignedDay <= maxAssignedDay) {
        const dIdx = this.days.findIndex((d) => d.dayNumber === place.assignedDay);
        if (dIdx !== -1) this.days[dIdx].places.push(place);
      } else {
        wishlist.push(place);
      }
    });

    this.wishlistGroups = this.countries
      .map((country) => {
        const countryCities = this.cities.filter((c) => c.countryId === country.id);
        return {
          country,
          cities: countryCities
            .map((city) => ({
              city,
              places: wishlist.filter((p) => p.cityId === city.id),
            }))
            .filter((gc) => gc.places.length > 0),
        };
      })
      .filter((gc) => gc.cities.length > 0);
  }

  get unassignedCount(): number {
    return this.allPlaces.filter((p) => !p.assignedDay).length;
  }

  get mapPlaces(): MapPlace[] {
    return this.allPlaces.map((p) => {
      // Use the current visual state (which day column holds the place)
      // instead of p.assignedDay, which may be stale during in-flight Firebase updates.
      const assignedDayObj = this.days.find((d) => d.places.some((dp) => dp.id === p.id));
      return {
        ...p,
        dayNumber: assignedDayObj?.dayNumber ?? null,
        dayLabel: assignedDayObj?.dateLabel || undefined,
      };
    });
  }

  get allDropListIds(): string[] {
    const dayIds = this.days.map((d) => `day-${d.dayNumber}`);
    const wishlistIds = this.wishlistGroups.flatMap((g) =>
      g.cities.map((c) => `wishlist-${c.city.id}`),
    );
    return ['wishlist-unassign', ...dayIds, ...wishlistIds];
  }

  drop(event: CdkDragDrop<Place[]>, targetDay: number | null): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      const movedItem = event.container.data[event.currentIndex];
      if (movedItem.id) {
        this.firebaseService
          .updatePlaceDay(movedItem, targetDay)
          .catch(() => this.toast.error('Erro ao mover o local. Tenta novamente.'));
      }
    }
  }
}
