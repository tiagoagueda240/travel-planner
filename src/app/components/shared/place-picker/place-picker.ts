import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GeoService, PlaceSuggestion } from '../../../services/geo';

@Component({
  selector: 'app-place-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './place-picker.html',
  styleUrls: ['./place-picker.scss'],
})
export class PlacePickerComponent implements OnChanges, OnDestroy {
  private readonly geo = inject(GeoService);
  private sub = new Subscription();

  /** Cidade pré-preenchida (cidade activa), pode ser alterada pelo utilizador */
  @Input() defaultCity = '';
  /** Emite o local seleccionado com nome e coordenadas */
  @Output() picked = new EventEmitter<PlaceSuggestion>();

  expanded = false;
  cityQuery = '';
  places: PlaceSuggestion[] = [];
  loading = false;
  searched = false;
  error = false;
  notFound = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['defaultCity'] && !this.cityQuery) {
      this.cityQuery = this.defaultCity;
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggle(): void {
    this.expanded = !this.expanded;
  }

  searchPlaces(): void {
    const city = this.cityQuery.trim();
    if (!city) return;
    this.loading = true;
    this.error = false;
    this.notFound = false;
    this.places = [];
    this.searched = false;

    this.sub.add(
      this.geo.getCityCoordinates(city).subscribe({
        next: (coords) => {
          if (!coords) {
            this.loading = false;
            this.searched = true;
            this.notFound = true;
            return;
          }
          this.sub.add(
            this.geo.getPlacesNear(coords.lat, coords.lon).subscribe({
              next: (places) => {
                this.places = places;
                this.loading = false;
                this.searched = true;
              },
              error: () => {
                this.loading = false;
                this.searched = true;
                this.error = true;
              },
            }),
          );
        },
        error: () => {
          this.loading = false;
          this.searched = true;
          this.error = true;
        },
      }),
    );
  }

  pick(place: PlaceSuggestion): void {
    this.picked.emit(place);
    this.expanded = false;
  }

  kindLabel(kinds: string): string {
    const first = kinds.split(',')[0].replace(/_/g, ' ');
    return first.charAt(0).toUpperCase() + first.slice(1);
  }
}
