import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { combineLatest, filter, map, Subscription, switchMap, tap } from 'rxjs';
import { City, Country, Itinerary, Place } from '../../../models/models';
import { FirebaseService } from '../../../services/firebase';
import { PlaceSuggestion } from '../../../services/geo';
import { ToastService } from '../../../services/toast';
import { AutocompleteComponent } from '../../shared/autocomplete/autocomplete';
import { ImagePickerComponent } from '../../shared/image-picker/image-picker';
import { MapViewComponent } from '../../shared/map-view/map-view';
import { PlaceCardComponent } from '../../shared/place-card/place-card';
import { ShareModalComponent } from '../../shared/share-modal/share-modal';

@Component({
  selector: 'app-itinerary-countries',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    PlaceCardComponent,
    ShareModalComponent,
    ImagePickerComponent,
    AutocompleteComponent,
    MapViewComponent,
  ],
  templateUrl: './itinerary-countries.html',
  styleUrls: ['./itinerary-countries.scss'],
})
export class ItineraryCountriesComponent implements OnInit {
  private readonly firebaseService = inject(FirebaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  itineraryId = '';
  itineraryName = 'A carregar...';
  itinerary: Itinerary | null = null;
  isOwner = false;
  showShareModal = false;

  // Level 1 – Countries
  countries: Country[] = [];
  showAddCountryForm = false;
  newCountryName = '';
  newCountryImageUrl = '';
  activeCountry: Country | null = null;
  editingCountry: Country | null = null;
  editCountryName = '';
  editCountryImageUrl = '';
  confirmDeleteCountry = false;

  // Level 2 – Cities
  cities: City[] = [];
  showAddCityForm = false;
  newCityName = '';
  newCityImageUrl = '';
  activeCity: City | null = null;
  editingCity: City | null = null;
  editCityName = '';
  editCityImageUrl = '';
  confirmDeleteCity = false;

  // Level 3 – Places
  places: Place[] = [];
  showMap = false;
  showPlaceForm = false;
  editingPlace: Place | null = null;
  newPlaceName = '';
  newPlaceImageUrl = '';
  newPlaceLink = '';
  newPlaceLat: number | null = null;
  newPlaceLon: number | null = null;

  private citiesSub: Subscription | null = null;
  private placesSub: Subscription | null = null;

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
          ]),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([itinerary, countries]) => {
        if (itinerary) {
          this.itinerary = itinerary;
          this.itineraryName = itinerary.name;
          this.isOwner = this.firebaseService.isOwner(itinerary);
        }
        this.countries = countries;
        if (!this.activeCountry && countries.length === 1) {
          this.selectCountry(countries[0]);
        }
      });
  }

  // --- COUNTRIES ---
  toggleAddCountryForm(): void {
    this.showAddCountryForm = !this.showAddCountryForm;
    if (!this.showAddCountryForm) {
      this.newCountryName = '';
      this.newCountryImageUrl = '';
    }
    this.editingCountry = null;
  }

  async createCountry(): Promise<void> {
    if (this.newCountryName.trim().length < 2) return;
    try {
      const docRef = await this.firebaseService.addCountry({
        itineraryId: this.itineraryId,
        name: this.newCountryName.trim(),
        imageUrl: this.newCountryImageUrl.trim(),
      });
      const created: Country = {
        id: docRef.id,
        itineraryId: this.itineraryId,
        name: this.newCountryName.trim(),
        imageUrl: this.newCountryImageUrl.trim(),
      };
      this.toggleAddCountryForm();
      this.selectCountry(created);
    } catch {
      this.toast.error('Erro ao criar o país. Tenta novamente.');
    }
  }

  selectCountry(country: Country): void {
    this.citiesSub?.unsubscribe();
    this.placesSub?.unsubscribe();
    this.activeCountry = country;
    this.activeCity = null;
    this.cities = [];
    this.places = [];
    this.showAddCityForm = false;
    this.editingCountry = null;
    this.editingCity = null;
    this.closePlaceForm();
    this.citiesSub = this.firebaseService
      .getCitiesByCountry(this.itineraryId, country.id!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.cities = data;
        if (!this.activeCity && data.length === 1) {
          this.selectCity(data[0]);
        }
      });
  }

  openEditCountryForm(country: Country): void {
    this.editingCountry = country;
    this.editCountryName = country.name;
    this.editCountryImageUrl = country.imageUrl ?? '';
    this.showAddCountryForm = false;
  }

  closeEditCountryForm(): void {
    this.editingCountry = null;
    this.editCountryName = '';
    this.editCountryImageUrl = '';
  }

  async saveCountry(): Promise<void> {
    if (!this.editingCountry?.id || this.editCountryName.trim().length < 2) return;
    try {
      await this.firebaseService.updateCountry(this.itineraryId, this.editingCountry.id, {
        name: this.editCountryName.trim(),
        imageUrl: this.editCountryImageUrl.trim(),
      });
      if (this.activeCountry?.id === this.editingCountry.id) {
        this.activeCountry = {
          ...this.activeCountry,
          name: this.editCountryName.trim(),
          imageUrl: this.editCountryImageUrl.trim(),
        };
      }
      this.closeEditCountryForm();
    } catch {
      this.toast.error('Erro ao guardar o país. Tenta novamente.');
    }
  }

  // --- CITIES ---
  toggleAddCityForm(): void {
    this.showAddCityForm = !this.showAddCityForm;
    if (!this.showAddCityForm) {
      this.newCityName = '';
      this.newCityImageUrl = '';
    }
    this.editingCity = null;
  }

  async createCity(): Promise<void> {
    if (this.newCityName.trim().length < 2 || !this.activeCountry?.id) return;
    try {
      const docRef = await this.firebaseService.addCity({
        countryId: this.activeCountry.id,
        itineraryId: this.itineraryId,
        name: this.newCityName.trim(),
        imageUrl: this.newCityImageUrl.trim(),
      });
      const created: City = {
        id: docRef.id,
        countryId: this.activeCountry.id,
        name: this.newCityName.trim(),
        imageUrl: this.newCityImageUrl.trim(),
      };
      this.toggleAddCityForm();
      this.selectCity(created);
    } catch {
      this.toast.error('Erro ao criar a cidade. Tenta novamente.');
    }
  }

  selectCity(city: City): void {
    this.placesSub?.unsubscribe();
    this.activeCity = city;
    this.places = [];
    this.editingCity = null;
    this.closePlaceForm();
    this.placesSub = this.firebaseService
      .getPlacesByCity(this.itineraryId, this.activeCountry!.id!, city.id!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => (this.places = data));
  }

  openEditCityForm(city: City): void {
    this.editingCity = city;
    this.editCityName = city.name;
    this.editCityImageUrl = city.imageUrl ?? '';
    this.showAddCityForm = false;
  }

  closeEditCityForm(): void {
    this.editingCity = null;
    this.editCityName = '';
    this.editCityImageUrl = '';
  }

  async saveCity(): Promise<void> {
    if (!this.editingCity?.id || this.editCityName.trim().length < 2) return;
    try {
      await this.firebaseService.updateCity(
        this.itineraryId,
        this.activeCountry!.id!,
        this.editingCity.id,
        {
          name: this.editCityName.trim(),
          imageUrl: this.editCityImageUrl.trim(),
        },
      );
      if (this.activeCity?.id === this.editingCity.id) {
        this.activeCity = {
          ...this.activeCity,
          name: this.editCityName.trim(),
          imageUrl: this.editCityImageUrl.trim(),
        };
      }
      this.closeEditCityForm();
    } catch {
      this.toast.error('Erro ao guardar a cidade. Tenta novamente.');
    }
  }

  // --- PLACES ---
  openPlaceForm(place?: Place): void {
    this.editingPlace = place ?? null;
    this.newPlaceName = place?.name ?? '';
    this.newPlaceImageUrl = place?.imageUrl ?? '';
    this.newPlaceLink = place?.link ?? '';
    this.newPlaceLat = place?.lat ?? null;
    this.newPlaceLon = place?.lon ?? null;
    this.showPlaceForm = true;
  }

  onPlacePicked(suggestion: PlaceSuggestion): void {
    this.newPlaceName = suggestion.name;
    this.newPlaceLat = suggestion.lat;
    this.newPlaceLon = suggestion.lon;
  }

  closePlaceForm(): void {
    this.showPlaceForm = false;
    this.editingPlace = null;
    this.newPlaceName = '';
    this.newPlaceImageUrl = '';
    this.newPlaceLink = '';
    this.newPlaceLat = null;
    this.newPlaceLon = null;
  }

  async savePlace(): Promise<void> {
    if (this.newPlaceName.trim().length < 2 || !this.activeCity?.id) return;
    const data = {
      cityId: this.activeCity.id,
      countryId: this.activeCountry!.id!,
      itineraryId: this.itineraryId,
      name: this.newPlaceName.trim(),
      imageUrl: this.newPlaceImageUrl.trim(),
      link: this.newPlaceLink.trim(),
      lat: this.newPlaceLat,
      lon: this.newPlaceLon,
    };
    try {
      if (this.editingPlace?.id) {
        await this.firebaseService.updatePlace(
          this.itineraryId,
          this.activeCountry!.id!,
          this.activeCity!.id!,
          this.editingPlace.id,
          data,
        );
      } else {
        await this.firebaseService.addPlace(data as Place);
      }
      this.closePlaceForm();
    } catch {
      this.toast.error('Erro ao guardar o local. Tenta novamente.');
    }
  }

  async deletePlace(placeId: string): Promise<void> {
    try {
      await this.firebaseService.deletePlace(
        this.itineraryId,
        this.activeCountry!.id!,
        this.activeCity!.id!,
        placeId,
      );
    } catch {
      this.toast.error('Erro ao eliminar o local. Tenta novamente.');
    }
  }

  async confirmAndDeleteCity(): Promise<void> {
    if (!this.activeCity?.id) return;
    try {
      await this.firebaseService.deleteCity(
        this.itineraryId,
        this.activeCountry!.id!,
        this.activeCity.id,
      );
      this.placesSub?.unsubscribe();
      this.activeCity = null;
      this.places = [];
      this.confirmDeleteCity = false;
    } catch {
      this.toast.error('Erro ao eliminar a cidade. Tenta novamente.');
    }
  }

  async confirmAndDeleteCountry(): Promise<void> {
    if (!this.activeCountry?.id) return;
    try {
      await this.firebaseService.deleteCountry(this.itineraryId, this.activeCountry.id);
      this.citiesSub?.unsubscribe();
      this.placesSub?.unsubscribe();
      this.activeCountry = null;
      this.activeCity = null;
      this.cities = [];
      this.places = [];
      this.confirmDeleteCountry = false;
    } catch {
      this.toast.error('Erro ao eliminar o país. Tenta novamente.');
    }
  }

  goToPlanning(): void {
    this.router.navigate(['/itinerario', this.itineraryId, 'planear']);
  }
}
