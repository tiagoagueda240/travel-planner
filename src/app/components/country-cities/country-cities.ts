import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { City, Country } from '../../models/models';
import { FirebaseService } from '../../services/firebase';

@Component({
  selector: 'app-country-cities',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './country-cities.html',
  styleUrls: ['./country-cities.scss']
})
export class CountryCitiesComponent implements OnInit {
  private firebaseService = inject(FirebaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  itineraryId = '';
  countryId = '';
  countryName = 'A carregar...';
  cities: City[] = [];
  showAddForm = false;

  newCityName = '';
  newCityStart = '';
  newCityEnd = '';

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.itineraryId = params.get('itineraryId') || '';
      this.countryId = params.get('countryId') || '';

      if (this.countryId) {
        this.firebaseService.getCountry(this.countryId).subscribe(c => {
          if (c) this.countryName = c.name;
        });
        this.firebaseService.getCitiesByCountry(this.countryId).subscribe(data => this.cities = data);
      }
    });
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.newCityName = '';
      this.newCityStart = '';
      this.newCityEnd = '';
    }
  }

  async createCity() {
    if (this.newCityName.trim().length < 2 || !this.newCityStart || !this.newCityEnd) return;
    try {
      const docRef = await this.firebaseService.addCity({
        countryId: this.countryId,
        itineraryId: this.itineraryId, // Propagamos por conveniência
        name: this.newCityName.trim(),
        startDate: this.newCityStart,
        endDate: this.newCityEnd
      });
      this.toggleAddForm();
      this.router.navigate(['/itinerario', this.itineraryId, 'pais', this.countryId, 'cidade', docRef.id]);
    } catch (error) { console.error(error); }
  }
}