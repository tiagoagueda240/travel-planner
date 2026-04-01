import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Itinerary } from '../../models/models';
import { FirebaseService } from '../../services/firebase';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit {
  private firebaseService = inject(FirebaseService);
  private router = inject(Router);

  itineraries: Itinerary[] = [];
  showAddForm = false;

  newItineraryName = '';
  newItineraryStart = '';
  newItineraryEnd = '';

  ngOnInit() {
    this.firebaseService.getItineraries().subscribe(data => this.itineraries = data);
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.newItineraryName = '';
      this.newItineraryStart = '';
      this.newItineraryEnd = '';
    }
  }

  async createItinerary() {
    if (this.newItineraryName.trim().length < 2 || !this.newItineraryStart || !this.newItineraryEnd) return;
    try {
      const docRef = await this.firebaseService.addItinerary({
        name: this.newItineraryName.trim(),
        startDate: this.newItineraryStart,
        endDate: this.newItineraryEnd
      });
      this.toggleAddForm();
      this.router.navigate(['/itinerario', docRef.id]);
    } catch (error) { console.error(error); }
  }
}