import { Component, OnInit, inject } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Place } from '../../models/models';
import { DialogModule, Dialog } from '@angular/cdk/dialog';
import { FirebaseService } from '../../services/firebase';
import { AddPlaceModalComponent } from '../add-place-modal/add-place-modal';
import { PlaceCardComponent } from '../place-card/place-card';

@Component({
  selector: 'app-itinerary-board',
  standalone: true,
  imports: [CommonModule, DragDropModule, PlaceCardComponent, DialogModule, RouterModule, FormsModule],
  templateUrl: './itinerary-board.html',
  styleUrls: ['./itinerary-board.scss']
})
export class ItineraryBoardComponent implements OnInit {
  private firebaseService = inject(FirebaseService);
  private dialog = inject(Dialog);
  private route = inject(ActivatedRoute);

  activeTab: 'inventory' | 'itinerary' = 'inventory';
  itineraryId = '';
  countryId = '';
  currentCityId = '';
  cityName = 'A carregar...';
  startDate = '';
  endDate = '';

  wishlist: Place[] = [];
  days: { dayNumber: number, dateLabel: string, places: Place[] }[] = [];
  allPlaces: Place[] = [];

  showCalendar = false;
  selectingType: 'start' | 'end' = 'start';
  currentMonthDate = new Date();
  calendarDays: any[] = [];
  weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  get hasDatesDefined(): boolean {
    return !!this.startDate && !!this.endDate;
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.itineraryId = params.get('itineraryId') || '';
      this.countryId = params.get('countryId') || '';
      this.currentCityId = params.get('cityId') || '';

      if (this.currentCityId) {
        this.firebaseService.getCity(this.currentCityId).subscribe(city => {
          if (city) {
            this.cityName = city.name;
            this.startDate = city.startDate || '';
            this.endDate = city.endDate || '';
            this.buildGrid();
          }
        });

        this.firebaseService.getPlacesByCity(this.currentCityId).subscribe(places => {
          this.allPlaces = places;
          this.buildGrid();
        });
      }
    });
  }

  switchTab(tab: 'inventory' | 'itinerary') {
    if (tab === 'itinerary' && !this.hasDatesDefined) {
      alert('🔒 Precisas de definir as datas de início e fim desta cidade na barra lateral do itinerário antes de planear os dias!');
      return;
    }
    this.activeTab = tab;
  }

  // --- GESTÃO DE SÍTIOS ---
  openAddPlaceModal(place?: Place) {
    const dialogRef = this.dialog.open<Place>(AddPlaceModalComponent, {
      data: { cityId: this.currentCityId, place: place },
      panelClass: 'custom-dialog-backdrop'
    });

    dialogRef.closed.subscribe(async (result) => {
      if (result) {
        try {
          if (result.id) {
            const { id, ...updateData } = result;
            await this.firebaseService.updatePlace(id, updateData);
          } else {
            await this.firebaseService.addPlace(result);
          }
        } catch (error) {
          console.error("Erro ao gravar o local:", error);
        }
      }
    });
  }

  async deletePlace(placeId: string) {
    try {
      await this.firebaseService.deletePlace(placeId);
    } catch (error) {
      console.error("Erro ao eliminar o local:", error);
    }
  }

  async distribuirSitosInteligente() {
    if (this.days.length === 0 || this.wishlist.length === 0) return;
    if (!confirm(`Distribuir ${this.wishlist.length} sítios pelos ${this.days.length} dias automaticamente?`)) return;

    const promessas = this.wishlist.map((place, index) => {
      const targetDay = (index % this.days.length) + 1;
      if (place.id) {
        return this.firebaseService.updatePlaceDay(place.id, targetDay);
      }
      return Promise.resolve();
    });

    await Promise.all(promessas);
  }

  // --- LÓGICA DO QUADRO ---
  buildGrid() {
    this.wishlist = [];
    let totalDays = 0;
    let startObj: Date | null = null;

    if (this.startDate && this.endDate) {
      startObj = new Date(this.startDate);
      const endObj = new Date(this.endDate);
      const diffTime = endObj.getTime() - startObj.getTime();
      if (diffTime >= 0) totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    const maxAssignedDay = Math.max(...this.allPlaces.map(p => p.assignedDay || 0), totalDays);

    this.days = Array.from({ length: maxAssignedDay }, (_, i) => {
      let dateLabel = '';
      if (startObj) {
        const currentDate = new Date(startObj);
        currentDate.setDate(startObj.getDate() + i);
        dateLabel = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(currentDate);
      }
      return {
        dayNumber: i + 1,
        dateLabel: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
        places: []
      };
    });

    this.allPlaces.forEach(place => {
      if (place.assignedDay && place.assignedDay <= maxAssignedDay) {
        const dIdx = this.days.findIndex(d => d.dayNumber === place.assignedDay);
        if (dIdx !== -1) this.days[dIdx].places.push(place);
      } else {
        this.wishlist.push(place);
      }
    });
  }

  drop(event: CdkDragDrop<Place[]>, targetDay: number | null) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      const movedItem = event.container.data[event.currentIndex];
      if (movedItem.id) this.firebaseService.updatePlaceDay(movedItem.id, targetDay);
    }
  }

  // --- CALENDÁRIO ---
  openCalendar(type: 'start' | 'end') {
    this.selectingType = type;
    this.showCalendar = true;
    const refDate = type === 'start' && this.startDate ? new Date(this.startDate) : new Date();
    this.currentMonthDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    this.generateCalendar();
  }

  closeCalendar() {
    this.showCalendar = false;
    if (this.startDate && this.endDate) {
      this.firebaseService.updateCityDates(this.currentCityId, this.startDate, this.endDate);
      this.buildGrid();
    }
  }

  generateCalendar() {
    const year = this.currentMonthDate.getFullYear();
    const month = this.currentMonthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    this.calendarDays = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      this.calendarDays.push(this.createDayObj(new Date(year, month, -i), false));
    }
    for (let i = 1; i <= daysInMonth; i++) {
      this.calendarDays.push(this.createDayObj(new Date(year, month, i), true));
    }
    const remaining = 42 - this.calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      this.calendarDays.push(this.createDayObj(new Date(year, month + 1, i), false));
    }
  }

  createDayObj(date: Date, isCurrentMonth: boolean) {
    const dateStr = this.toLocalDateString(date);
    return {
      dayNumber: date.getDate(), dateStr, isCurrentMonth,
      isStart: dateStr === this.startDate, isEnd: dateStr === this.endDate,
      isBetween: this.startDate && this.endDate && dateStr > this.startDate && dateStr < this.endDate
    };
  }

  selectDate(day: any) {
    if (this.selectingType === 'start') {
      this.startDate = day.dateStr;
      this.selectingType = 'end';
    } else {
      this.endDate = day.dateStr < this.startDate ? this.startDate : day.dateStr;
      if (day.dateStr < this.startDate) this.startDate = day.dateStr;
      this.closeCalendar();
    }
    this.generateCalendar();
  }

  changeMonth(delta: number) {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() + delta, 1);
    this.generateCalendar();
  }

  private toLocalDateString(d: Date) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  formatDisplayDate(d: string) {
    if (!d) return 'Selecionar';
    return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' }).format(new Date(d));
  }

  get displayMonthYear() {
    return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(this.currentMonthDate);
  }

  addNewDay() {
    if (this.endDate) {
      const e = new Date(this.endDate);
      e.setDate(e.getDate() + 1);
      this.endDate = this.toLocalDateString(e);
      this.firebaseService.updateCityDates(this.currentCityId, this.startDate, this.endDate);
    }
    setTimeout(() => {
      const container = document.querySelector('.days-container');
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, 100);
  }
}