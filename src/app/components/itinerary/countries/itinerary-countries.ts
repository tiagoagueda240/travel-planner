import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { combineLatest, filter, map, Subscription, switchMap, tap } from 'rxjs';
import {
  Booking,
  BookingType,
  City,
  Country,
  DateRange,
  Itinerary,
  Place,
} from '../../../models/models';
import { DirtyStateService } from '../../../services/dirty-state';
import { FirebaseService } from '../../../services/firebase';
import { PlaceSuggestion } from '../../../services/geo';
import { ToastService } from '../../../services/toast';
import { AutocompleteComponent } from '../../shared/autocomplete/autocomplete';
import { DatePickerComponent } from '../../shared/date-picker/date-picker';
import { DateRangePickerComponent } from '../../shared/date-range-picker/date-range-picker';
import { ImagePickerComponent } from '../../shared/image-picker/image-picker';
import { MapPlace, MapViewComponent } from '../../shared/map-view/map-view';
import { PlaceCardComponent } from '../../shared/place-card/place-card';
import { ShareModalComponent } from '../../shared/share-modal/share-modal';
import { TimePickerComponent } from '../../shared/time-picker/time-picker';

@Component({
  selector: 'app-itinerary-countries',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    DragDropModule,
    PlaceCardComponent,
    ShareModalComponent,
    ImagePickerComponent,
    AutocompleteComponent,
    MapViewComponent,
    DateRangePickerComponent,
    DatePickerComponent,
    TimePickerComponent,
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
  readonly dirty = inject(DirtyStateService);

  itineraryId = '';
  itineraryName = 'A carregar...';
  itinerary: Itinerary | null = null;
  isOwner = false;
  showShareModal = false;
  activeTab: 'destinos' | 'reservas' = 'destinos';

  // Settings panel
  showSettingsPanel = false;
  editName = '';
  editStartDate = '';
  editEndDate = '';
  confirmDeleteItinerary = false;
  savingSettings = false;

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
  cityNotes = '';

  // Badge counts (for chip labels)
  citiesCountByCountry: Record<string, number> = {};
  placesCountByCity: Record<string, number> = {};

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

  // Level 4 – Bookings
  bookings: Booking[] = [];
  showBookingForm = false;
  editingBooking: Booking | null = null;
  activeBookingType: 'all' | BookingType = 'all';
  newBookingType: BookingType = 'flight';
  newBookingTitle = '';
  newBookingAirline = '';
  newBookingFlightNumber = '';
  newBookingShowMore = false;
  newBookingDate = '';
  newBookingTime = '';
  newBookingArrivalDate = '';
  newBookingArrivalTime = '';
  newBookingEndDate = '';
  newBookingLocation = '';
  newBookingReference = '';
  newBookingLink = '';
  newBookingNotes = '';
  newBookingDepartureLocation = '';
  newBookingArrivalLocation = '';
  newBookingLocationCity = '';
  newBookingLocationLat: number | null = null;
  newBookingLocationLon: number | null = null;

  readonly bookingTypes: { value: BookingType; label: string; icon: string }[] = [
    { value: 'flight', label: 'Voo', icon: '✈️' },
    { value: 'hotel', label: 'Dormida', icon: '🏨' },
    { value: 'bus', label: 'Transporte', icon: '🚌' },
    { value: 'other', label: 'Outro', icon: '📝' },
  ];

  get isBookingFormValid(): boolean {
    switch (this.newBookingType) {
      case 'flight':
        return (
          (!!this.newBookingAirline.trim() || !!this.newBookingFlightNumber.trim()) &&
          !!this.newBookingDepartureLocation.trim() &&
          !!this.newBookingArrivalLocation.trim()
        );
      case 'bus':
        return !!this.newBookingDepartureLocation.trim() && !!this.newBookingArrivalLocation.trim();
      case 'hotel':
        return !!this.newBookingLocation.trim();
      case 'other':
        return this.newBookingTitle.trim().length >= 2;
      default:
        return false;
    }
  }

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
        this.countries = countries
          .slice()
          .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));
        if (!this.activeCountry && countries.length === 1) {
          this.selectCountry(countries[0]);
        }
      });

    this.route.paramMap
      .pipe(
        map((params) => params.get('itineraryId') ?? ''),
        filter((id) => !!id),
        switchMap((id) => this.firebaseService.getBookings(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((bookings) => {
        this.bookings = bookings.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
      });

    // Badge counts per country / city
    this.route.paramMap
      .pipe(
        map((params) => params.get('itineraryId') ?? ''),
        filter((id) => !!id),
        switchMap((id) =>
          combineLatest([
            this.firebaseService.getCitiesByItinerary(id),
            this.firebaseService.getPlacesByItinerary(id),
          ]),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([cities, places]) => {
        const cm: Record<string, number> = {};
        for (const c of cities) cm[c.countryId] = (cm[c.countryId] ?? 0) + 1;
        this.citiesCountByCountry = cm;

        const pm: Record<string, number> = {};
        for (const p of places) pm[p.cityId] = (pm[p.cityId] ?? 0) + 1;
        this.placesCountByCity = pm;
      });
  }

  reorderCountries(event: CdkDragDrop<Country[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.countries, event.previousIndex, event.currentIndex);
    const key = `country-order-${this.itineraryId}`;
    const isRestored = this.countries.every((c, i) => (c.orderIndex ?? i) === i);
    if (isRestored) {
      this.dirty.clearWrite(key);
      return;
    }
    const snapshot = this.countries.map((c, i) => ({ id: c.id!, idx: i }));
    this.dirty.markWrite(key, () =>
      Promise.all(
        snapshot.map(({ id, idx }) =>
          this.firebaseService.updateCountry(this.itineraryId, id, { orderIndex: idx }),
        ),
      ).then(() => void 0),
    );
  }

  reorderCities(event: CdkDragDrop<City[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.cities, event.previousIndex, event.currentIndex);
    const countryId = this.activeCountry!.id!;
    const key = `city-order-${countryId}`;
    const isRestored = this.cities.every((c, i) => (c.orderIndex ?? i) === i);
    if (isRestored) {
      this.dirty.clearWrite(key);
      return;
    }
    const snapshot = this.cities.map((c, i) => ({ id: c.id!, idx: i }));
    this.dirty.markWrite(key, () =>
      Promise.all(
        snapshot.map(({ id, idx }) =>
          this.firebaseService.updateCity(this.itineraryId, countryId, id, { orderIndex: idx }),
        ),
      ).then(() => void 0),
    );
  }

  saveCityNotes(): void {
    if (!this.activeCity?.id) return;
    const cityId = this.activeCity.id;
    const countryId = this.activeCountry!.id!;
    const notes = this.cityNotes;
    const original = this.activeCity.notes ?? '';
    if (notes === original) {
      this.dirty.clearWrite(`city-notes-${cityId}`);
    } else {
      this.dirty.markWrite(`city-notes-${cityId}`, () =>
        this.firebaseService.updateCity(this.itineraryId, countryId, cityId, { notes }),
      );
    }
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
        this.cities = data.slice().sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));
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
    this.cityNotes = city.notes ?? '';
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

  get mapPlaces(): MapPlace[] {
    return this.places.map((p) => ({ ...p, dayNumber: p.assignedDay ?? null }));
  }

  // --- SETTINGS ---
  openSettingsPanel(): void {
    this.editName = this.itinerary?.name ?? '';
    this.editStartDate = this.itinerary?.startDate ?? '';
    this.editEndDate = this.itinerary?.endDate ?? '';
    this.confirmDeleteItinerary = false;
    this.showSettingsPanel = true;
  }

  closeSettingsPanel(): void {
    this.showSettingsPanel = false;
    this.confirmDeleteItinerary = false;
  }

  onSettingsRangeChange(range: DateRange): void {
    this.editStartDate = range.startDate;
    this.editEndDate = range.endDate;
  }

  async saveSettings(): Promise<void> {
    if (this.editName.trim().length < 2 || this.savingSettings) return;
    this.savingSettings = true;
    try {
      await this.firebaseService.updateItinerary(this.itineraryId, {
        name: this.editName.trim(),
        startDate: this.editStartDate || undefined,
        endDate: this.editEndDate || undefined,
      });
      this.itineraryName = this.editName.trim();
      this.closeSettingsPanel();
      this.toast.success('Itinerário atualizado.');
    } catch {
      this.toast.error('Erro ao guardar. Tenta novamente.');
    } finally {
      this.savingSettings = false;
    }
  }

  async confirmDeleteItineraryFn(): Promise<void> {
    try {
      await this.firebaseService.deleteItinerary(this.itineraryId);
      this.router.navigate(['/']);
    } catch {
      this.toast.error('Erro ao eliminar o itinerário. Tenta novamente.');
    }
  }

  // --- BOOKINGS ---
  get filteredBookings(): Booking[] {
    if (this.activeBookingType === 'all') return this.bookings;
    return this.bookings.filter((b) => b.type === this.activeBookingType);
  }

  bookingIcon(type: BookingType): string {
    const icons: Record<BookingType, string> = {
      flight: '✈️',
      hotel: '🏨',
      bus: '🚌',
      other: '📝',
    };
    return icons[type];
  }

  openBookingForm(booking?: Booking): void {
    this.editingBooking = booking ?? null;
    this.newBookingType = booking?.type ?? 'flight';
    this.newBookingTitle = booking?.title ?? '';
    this.newBookingAirline = booking?.airline ?? '';
    this.newBookingFlightNumber = booking?.flightNumber ?? '';
    this.newBookingShowMore = false;
    this.newBookingDate = booking?.date ?? '';
    this.newBookingTime = booking?.time ?? '';
    this.newBookingArrivalDate = booking?.arrivalDate ?? '';
    this.newBookingArrivalTime = booking?.arrivalTime ?? '';
    this.newBookingEndDate = booking?.endDate ?? '';
    this.newBookingLocation = booking?.location ?? '';
    this.newBookingReference = booking?.reference ?? '';
    this.newBookingLink = booking?.link ?? '';
    this.newBookingNotes = booking?.notes ?? '';
    this.newBookingDepartureLocation = booking?.departureLocation ?? '';
    this.newBookingArrivalLocation = booking?.arrivalLocation ?? '';
    this.newBookingLocationCity = booking?.locationCity ?? '';
    this.newBookingLocationLat = booking?.locationLat ?? null;
    this.newBookingLocationLon = booking?.locationLon ?? null;
    this.showBookingForm = true;
  }

  closeBookingForm(): void {
    this.showBookingForm = false;
    this.editingBooking = null;
    this.newBookingTitle = '';
    this.newBookingAirline = '';
    this.newBookingFlightNumber = '';
    this.newBookingShowMore = false;
    this.newBookingDate = '';
    this.newBookingTime = '';
    this.newBookingArrivalDate = '';
    this.newBookingArrivalTime = '';
    this.newBookingEndDate = '';
    this.newBookingLocation = '';
    this.newBookingReference = '';
    this.newBookingLink = '';
    this.newBookingNotes = '';
    this.newBookingDepartureLocation = '';
    this.newBookingArrivalLocation = '';
    this.newBookingLocationCity = '';
    this.newBookingLocationLat = null;
    this.newBookingLocationLon = null;
  }

  onHotelCityPicked(suggestion: import('../../../services/geo').PlaceSuggestion): void {
    this.newBookingLocationLat = suggestion.lat;
    this.newBookingLocationLon = suggestion.lon;
  }

  onBookingHotelRangeChange(range: DateRange): void {
    this.newBookingDate = range.startDate;
    this.newBookingEndDate = range.endDate;
  }

  async saveBooking(): Promise<void> {
    if (!this.isBookingFormValid) return;
    let autoTitle = this.newBookingTitle.trim();
    if (!autoTitle) {
      if (this.newBookingType === 'flight' || this.newBookingType === 'bus') {
        const service = [this.newBookingAirline.trim(), this.newBookingFlightNumber.trim()]
          .filter(Boolean)
          .join(' ');
        const route = [
          this.newBookingDepartureLocation.trim(),
          this.newBookingArrivalLocation.trim(),
        ]
          .filter(Boolean)
          .join(' → ');
        autoTitle = service ? `${service} (${route})` : route;
      } else if (this.newBookingType === 'hotel') {
        autoTitle = this.newBookingLocation.trim();
      }
    }
    if (autoTitle.length < 2) return;
    const data: Booking = {
      itineraryId: this.itineraryId,
      type: this.newBookingType,
      title: autoTitle,
      airline: this.newBookingAirline.trim() || undefined,
      flightNumber: this.newBookingFlightNumber.trim() || undefined,
      date: this.newBookingDate || undefined,
      time: this.newBookingTime || undefined,
      arrivalDate:
        (['flight', 'bus'].includes(this.newBookingType)
          ? this.newBookingArrivalDate
          : undefined) || undefined,
      arrivalTime:
        (['flight', 'bus'].includes(this.newBookingType)
          ? this.newBookingArrivalTime
          : undefined) || undefined,
      departureLocation:
        (['flight', 'bus'].includes(this.newBookingType)
          ? this.newBookingDepartureLocation.trim()
          : undefined) || undefined,
      arrivalLocation:
        (['flight', 'bus'].includes(this.newBookingType)
          ? this.newBookingArrivalLocation.trim()
          : undefined) || undefined,
      endDate: this.newBookingEndDate || undefined,
      location: this.newBookingLocation.trim() || undefined,
      locationCity: this.newBookingLocationCity.trim() || undefined,
      locationLat: this.newBookingLocationLat ?? undefined,
      locationLon: this.newBookingLocationLon ?? undefined,
      reference: this.newBookingReference.trim() || undefined,
      link: this.newBookingLink.trim() || undefined,
      notes: this.newBookingNotes.trim() || undefined,
    };
    try {
      if (this.editingBooking?.id) {
        await this.firebaseService.updateBooking(this.itineraryId, this.editingBooking.id, data);
      } else {
        await this.firebaseService.addBooking(data);
      }
      this.closeBookingForm();
    } catch {
      this.toast.error('Erro ao guardar a reserva. Tenta novamente.');
    }
  }

  async deleteBooking(booking: Booking): Promise<void> {
    if (!booking.id) return;
    try {
      await this.firebaseService.deleteBooking(this.itineraryId, booking.id);
    } catch {
      this.toast.error('Erro ao eliminar a reserva. Tenta novamente.');
    }
  }
}
