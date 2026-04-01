import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { City, DateRange, Itinerary } from '../../models/models';
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
  showAddForm = false;
  saving = false;

  newItineraryName = '';
  newItineraryStart = '';
  newItineraryEnd = '';

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
    this.firebaseService
      .getItineraries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => (this.itineraries = data));

    this.firebaseService
      .getAllCities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cities: City[]) => {
        const map: Record<string, string[]> = {};
        for (const city of cities) {
          if (city.itineraryId && city.imageUrl) {
            if (!map[city.itineraryId]) map[city.itineraryId] = [];
            if (map[city.itineraryId].length < 5) map[city.itineraryId].push(city.imageUrl);
          }
        }
        this.cityImagesMap = map;
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
