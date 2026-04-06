import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { combineLatest, of, shareReplay, switchMap, tap } from 'rxjs';
import { DateRange, Itinerary } from '../../models/models';
import { AuthService } from '../../services/auth';
import { FirebaseService } from '../../services/firebase';
import { ToastService } from '../../services/toast';
import { DateRangePickerComponent } from '../shared/date-range-picker/date-range-picker';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DateRangePickerComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class DashboardComponent implements OnInit {
  private readonly firebaseService = inject(FirebaseService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  itineraries: Itinerary[] = [];
  cityImagesMap: Record<string, string[]> = {};
  statsMap: Record<string, { countries: number; cities: number; places: number }> = {};
  showAddForm = false;
  saving = false;
  sortBy: 'date' | 'name' = 'date';

  newItineraryName = '';
  newItineraryStart = '';
  newItineraryEnd = '';

  get sortedItineraries(): Itinerary[] {
    return [...this.itineraries].sort((a, b) => {
      if (this.sortBy === 'name') return a.name.localeCompare(b.name);
      return (a.startDate ?? '').localeCompare(b.startDate ?? '');
    });
  }

  daysUntilTrip(trip: Itinerary): number | null {
    if (!trip.startDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(trip.startDate + 'T00:00:00');
    const diffMs = start.getTime() - today.getTime();
    if (diffMs < 0) return null;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  getStats(tripId: string | undefined): { countries: number; cities: number; places: number } {
    return this.statsMap[tripId ?? ''] ?? { countries: 0, cities: 0, places: 0 };
  }

  get userEmail(): string {
    return this.authService.currentUser?.email ?? '';
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      this.router.navigate(['/login']);
    } catch {
      this.toast.error('Erro ao terminar sessão. Tenta novamente.');
    }
  }

  ngOnInit(): void {
    // shareReplay(1) ensures a single Firestore listener is shared between
    // the itineraries list and the cities/places stats pipeline.
    const itineraries$ = this.firebaseService.getItineraries().pipe(shareReplay(1));

    itineraries$
      .pipe(
        tap((data) => (this.itineraries = data)),
        switchMap((itineraries) => {
          const ids = itineraries.map((i) => i.id!).filter(Boolean);
          if (ids.length === 0) return of<[[], []]>([[], []]);
          return combineLatest([
            this.firebaseService.getCitiesForIds(ids),
            this.firebaseService.getPlacesForIds(ids),
          ]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([cities, places]) => {
        const imageMap: Record<string, string[]> = {};
        const stats: Record<string, { countries: number; cities: number; places: number }> = {};
        const countryIdSets: Record<string, Set<string>> = {};

        for (const city of cities) {
          const id = city.itineraryId;
          if (!id) continue;
          if (!imageMap[id]) imageMap[id] = [];
          if (imageMap[id].length < 5 && city.imageUrl) imageMap[id].push(city.imageUrl);
          if (!stats[id]) stats[id] = { countries: 0, cities: 0, places: 0 };
          stats[id].cities++;
          if (!countryIdSets[id]) countryIdSets[id] = new Set();
          countryIdSets[id].add(city.countryId);
        }
        for (const [id, set] of Object.entries(countryIdSets)) {
          stats[id].countries = set.size;
        }
        for (const place of places) {
          const id = place.itineraryId;
          if (!id) continue;
          if (!stats[id]) stats[id] = { countries: 0, cities: 0, places: 0 };
          stats[id].places++;
        }
        this.cityImagesMap = imageMap;
        this.statsMap = stats;
      });
  }

  getCityImages(itineraryId: string | undefined): string[] {
    return itineraryId ? (this.cityImagesMap[itineraryId] ?? []) : [];
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.newItineraryName = '';
      this.newItineraryStart = '';
      this.newItineraryEnd = '';
    }
  }

  onRangeChange(range: DateRange): void {
    this.newItineraryStart = range.startDate;
    this.newItineraryEnd = range.endDate;
  }

  async createItinerary(): Promise<void> {
    if (
      this.newItineraryName.trim().length < 2 ||
      !this.newItineraryStart ||
      !this.newItineraryEnd ||
      this.saving
    )
      return;

    this.saving = true;
    try {
      const docRef = await this.firebaseService.addItinerary({
        name: this.newItineraryName.trim(),
        startDate: this.newItineraryStart,
        endDate: this.newItineraryEnd,
      });
      this.toggleAddForm();
      this.router.navigate(['/itinerario', docRef.id]);
    } catch {
      this.toast.error('Erro ao criar a viagem. Tenta novamente.');
    } finally {
      this.saving = false;
    }
  }
}
