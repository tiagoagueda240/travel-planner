import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Country, Itinerary } from '../../models/models';
import { FirebaseService } from '../../services/firebase';

@Component({
  selector: 'app-itinerary-countries',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './itinerary-countries.html',
  styleUrls: ['./itinerary-countries.scss']
})
export class ItineraryCountriesComponent implements OnInit {
  private firebaseService = inject(FirebaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  itineraryId = '';
  itineraryName = 'A carregar...';
  countries: Country[] = [];
  showAddForm = false;

  newCountryName = '';
  newCountryStart = '';
  newCountryEnd = '';

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.itineraryId = params.get('itineraryId') || '';
      if (this.itineraryId) {
        this.firebaseService.getItinerary(this.itineraryId).subscribe(it => {
          if (it) this.itineraryName = it.name;
        });
        this.firebaseService.getCountriesByItinerary(this.itineraryId).subscribe(data => this.countries = data);
      }
    });
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.newCountryName = '';
      this.newCountryStart = '';
      this.newCountryEnd = '';
    }
  }

  async createCountry() {
    if (this.newCountryName.trim().length < 2 || !this.newCountryStart || !this.newCountryEnd) return;
    try {
      const docRef = await this.firebaseService.addCountry({
        itineraryId: this.itineraryId,
        name: this.newCountryName.trim(),
        startDate: this.newCountryStart,
        endDate: this.newCountryEnd
      });
      this.toggleAddForm();
      this.router.navigate(['/itinerario', this.itineraryId, 'pais', docRef.id]);
    } catch (error) { console.error(error); }
  }
}