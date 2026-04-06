import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { combineLatest, filter, map, switchMap, tap } from 'rxjs';
import {
  Booking,
  City,
  Country,
  DayItem,
  Itinerary,
  Place,
  StickyNote,
  StickyNoteColor,
} from '../../../models/models';
import { DirtyStateService } from '../../../services/dirty-state';
import { FirebaseService } from '../../../services/firebase';
import { ToastService } from '../../../services/toast';
import { MapPlace, MapViewComponent } from '../../shared/map-view/map-view';
import { PlaceCardComponent } from '../../shared/place-card/place-card';
import { ShareModalComponent } from '../../shared/share-modal/share-modal';

interface GroupedCity {
  city: City;
  items: DayItem[];
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
    FormsModule,
    PlaceCardComponent,
    RouterModule,
    ShareModalComponent,
    MapViewComponent,
  ],
  templateUrl: './itinerary-board.html',
  styleUrls: ['./itinerary-board.scss'],
})
export class ItineraryBoardComponent implements OnInit, AfterViewInit {
  private readonly firebaseService = inject(FirebaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly dirty = inject(DirtyStateService);

  @ViewChild('daysContainer') daysContainerRef?: ElementRef<HTMLElement>;

  canScrollLeft = false;
  canScrollRight = false;

  itineraryId = '';
  itineraryName = 'A carregar...';
  startDate = '';
  endDate = '';
  itinerary: Itinerary | null = null;
  isOwner = false;
  showShareModal = false;
  showMap = false;
  sidebarCollapsed = false;
  showBudgetPanel = false;

  allPlaces: Place[] = [];
  countries: Country[] = [];
  cities: City[] = [];
  dayNotes: Record<string, string> = {};
  private originalDayNotes: Record<string, string> = {};
  stickyNotes: StickyNote[] = [];

  readonly noteColors: { value: StickyNoteColor; bg: string }[] = [
    { value: 'yellow', bg: '#fef9c3' },
    { value: 'pink', bg: '#fce7f3' },
    { value: 'blue', bg: '#dbeafe' },
    { value: 'green', bg: '#dcfce7' },
    { value: 'purple', bg: '#ede9fe' },
  ];

  wishlistGroups: GroupedCountry[] = [];
  days: { dayNumber: number; dateLabel: string; dateStr: string; items: DayItem[] }[] = [];
  unassignZone: DayItem[] = [];
  bookings: Booking[] = [];

  ngAfterViewInit(): void {
    this.updateScrollState();
  }

  onColumnsScroll(): void {
    this.updateScrollState();
  }

  private updateScrollState(): void {
    const el = this.daysContainerRef?.nativeElement;
    if (!el) return;
    const prev = this.canScrollLeft;
    const prevR = this.canScrollRight;
    this.canScrollLeft = el.scrollLeft > 8;
    this.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 8;
    if (prev !== this.canScrollLeft || prevR !== this.canScrollRight) {
      this.cdr.detectChanges();
    }
  }

  scrollColumns(direction: 1 | -1): void {
    const el = this.daysContainerRef?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * 340, behavior: 'smooth' });
  }

  ngOnInit(): void {
    // Single subscription — all 6 streams are coordinated under the same switchMap,
    // so a route change atomically tears down and re-subscribes everything together,
    // eliminating the previous race condition between 3 independent paramMap streams.
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
            this.firebaseService.getStickyNotes(id),
            this.firebaseService.getBookings(id),
          ]),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([itinerary, countries, cities, places, notes, bookings]) => {
        if (itinerary) {
          const firstLoad = !this.itinerary;
          this.itinerary = itinerary;
          this.itineraryName = itinerary.name;
          this.startDate = itinerary.startDate ?? '';
          this.endDate = itinerary.endDate ?? '';
          this.isOwner = this.firebaseService.isOwner(itinerary);
          if (firstLoad) {
            this.dayNotes = { ...(itinerary.dayNotes ?? {}) };
            this.originalDayNotes = { ...(itinerary.dayNotes ?? {}) };
          }
        }
        this.countries = countries;
        this.cities = cities;
        this.allPlaces = places;
        this.stickyNotes = notes;
        this.bookings = bookings.sort((a, b) => {
          const dateCompare = (a.date ?? '').localeCompare(b.date ?? '');
          if (dateCompare !== 0) return dateCompare;
          return (a.time ?? '').localeCompare(b.time ?? '');
        });
        this.buildGrid();
      });
  }

  distributeNotes(): void {
    // Clear notes from all day items, rebuild merged+sorted items
    for (const day of this.days) {
      day.items = day.items.filter((i) => i.type === 'place');
    }
    for (const note of this.stickyNotes) {
      if (note.assignedDay !== null) {
        const day = this.days.find((d) => d.dayNumber === note.assignedDay);
        if (day) day.items.push({ type: 'note', data: note });
      }
    }
    for (const day of this.days) {
      day.items.sort((a, b) => (a.data.orderIndex ?? 0) - (b.data.orderIndex ?? 0));
    }
  }

  async addNote(dayNumber: number): Promise<void> {
    try {
      await this.firebaseService.addStickyNote({
        itineraryId: this.itineraryId,
        text: '',
        assignedDay: dayNumber,
        color: 'yellow',
        orderIndex: this.days.find((d) => d.dayNumber === dayNumber)?.items.length ?? 0,
      });
    } catch {
      this.toast.error('Erro ao criar a nota.');
    }
  }

  async deleteNote(note: StickyNote): Promise<void> {
    try {
      await this.firebaseService.deleteStickyNote(this.itineraryId, note.id!);
    } catch {
      this.toast.error('Erro ao eliminar a nota.');
    }
  }

  async saveNoteText(note: StickyNote): Promise<void> {
    if (!note.id) return;
    this.dirty.markWrite(`note-text-${note.id}`, () =>
      this.firebaseService.updateStickyNote(this.itineraryId, note.id!, { text: note.text }),
    );
  }

  async changeNoteColor(note: StickyNote, color: StickyNoteColor): Promise<void> {
    if (!note.id) return;
    note.color = color;
    this.dirty.markWrite(`note-color-${note.id}`, () =>
      this.firebaseService.updateStickyNote(this.itineraryId, note.id!, { color }),
    );
  }

  dropNote(event: CdkDragDrop<StickyNote[]>, targetDay: number): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      const movedNote = event.container.data[event.currentIndex];
      if (movedNote.id) {
        this.firebaseService
          .updateStickyNote(this.itineraryId, movedNote.id, { assignedDay: targetDay })
          .catch(() => this.toast.error('Erro ao mover a nota.'));
      }
    }
  }

  get allNoteDropListIds(): string[] {
    return this.days.map((d) => `note-day-${d.dayNumber}`);
  }

  noteColorBg(color: StickyNoteColor): string {
    return this.noteColors.find((c) => c.value === color)?.bg ?? '#fef9c3';
  }

  countPlaces(items: DayItem[]): number {
    return items.filter((i) => i.type === 'place').length;
  }

  distributeSmartly(): void {
    const unassigned = this.allPlaces.filter((p) => !p.assignedDay);
    if (this.days.length === 0 || unassigned.length === 0) return;
    unassigned.forEach((place, index) => {
      const targetDay = (index % this.days.length) + 1;
      place.assignedDay = targetDay; // optimistic local update
      if (place.id)
        this.dirty.markWrite(`place-day-${place.id}`, () =>
          this.firebaseService.updatePlaceDay(place, targetDay),
        );
    });
    this.buildGrid(); // reflect changes in the UI immediately
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

  unassignPlace(place: Place): void {
    if (!place.id) return;
    if ((place.assignedDay ?? null) === null) {
      this.dirty.clearWrite(`place-day-${place.id}`);
    } else {
      this.dirty.markWrite(`place-day-${place.id}`, () =>
        this.firebaseService.updatePlaceDay(place, null),
      );
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
        dateStr: startObj
          ? new Date(startObj.getTime() + i * 864e5).toISOString().slice(0, 10)
          : '',
        items: [],
      };
    });

    const wishlist: DayItem[] = [];
    this.allPlaces.forEach((place) => {
      if (place.assignedDay && place.assignedDay <= maxAssignedDay) {
        const dIdx = this.days.findIndex((d) => d.dayNumber === place.assignedDay);
        if (dIdx !== -1) this.days[dIdx].items.push({ type: 'place', data: place });
      } else {
        wishlist.push({ type: 'place', data: place });
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
              items: wishlist.filter(
                (i) => i.type === 'place' && (i.data as Place).cityId === city.id,
              ),
            }))
            .filter((gc) => gc.items.length > 0),
        };
      })
      .filter((gc) => gc.cities.length > 0);

    this.distributeNotes();
    // Update scroll arrows after data changes (setTimeout gives Angular time to render)
    setTimeout(() => {
      this.updateScrollState();
      this.peekScroll();
    }, 0);
  }

  private peekScrollDone = false;
  private peekScroll(): void {
    if (this.peekScrollDone) return;
    const el = this.daysContainerRef?.nativeElement;
    if (!el || el.scrollWidth <= el.clientWidth + 8) return;
    this.peekScrollDone = true;
    setTimeout(() => {
      el.scrollBy({ left: 80, behavior: 'smooth' });
      setTimeout(() => el.scrollBy({ left: -80, behavior: 'smooth' }), 550);
    }, 600);
  }

  get unassignedCount(): number {
    return this.allPlaces.filter((p) => !p.assignedDay).length;
  }

  // ─── BUDGET ───
  readonly currencyOptions = [
    { code: 'EUR', symbol: '€' },
    { code: 'USD', symbol: '$' },
    { code: 'GBP', symbol: '£' },
    { code: 'CHF', symbol: 'Fr' },
    { code: 'JPY', symbol: '¥' },
    { code: 'BRL', symbol: 'R$' },
    { code: 'CAD', symbol: 'C$' },
    { code: 'AUD', symbol: 'A$' },
    { code: 'SEK', symbol: 'kr' },
    { code: 'NOK', symbol: 'kr' },
    { code: 'DKK', symbol: 'kr' },
    { code: 'PLN', symbol: 'zł' },
    { code: 'CZK', symbol: 'Kč' },
    { code: 'AED', symbol: 'د.إ' },
  ];

  get currencySymbol(): string {
    const code = this.itinerary?.currency ?? 'EUR';
    return this.currencyOptions.find((c) => c.code === code)?.symbol ?? '€';
  }

  get totalBudget(): number {
    return this.itinerary?.budget ?? 0;
  }

  get totalSpentPlaces(): number {
    return this.allPlaces.reduce((sum, p) => sum + (p.cost ?? 0), 0);
  }

  get totalSpentBookings(): number {
    return this.bookings.reduce((sum, b) => sum + (b.cost ?? 0), 0);
  }

  get totalSpent(): number {
    return this.totalSpentPlaces + this.totalSpentBookings;
  }

  get remainingBudget(): number {
    return this.totalBudget - this.totalSpent;
  }

  get budgetPercent(): number {
    if (this.totalBudget <= 0) return 0;
    return Math.min(100, Math.round((this.totalSpent / this.totalBudget) * 100));
  }

  get budgetStatus(): 'ok' | 'warning' | 'danger' {
    if (this.totalBudget <= 0) return 'ok';
    const pct = this.budgetPercent;
    if (pct >= 100) return 'danger';
    if (pct >= 80) return 'warning';
    return 'ok';
  }

  get spentByCategory(): { label: string; icon: string; amount: number; type: string }[] {
    const flights = this.bookings
      .filter((b) => b.type === 'flight')
      .reduce((s, b) => s + (b.cost ?? 0), 0);
    const hotels = this.bookings
      .filter((b) => b.type === 'hotel')
      .reduce((s, b) => s + (b.cost ?? 0), 0);
    const transport = this.bookings
      .filter((b) => b.type === 'bus')
      .reduce((s, b) => s + (b.cost ?? 0), 0);
    const other = this.bookings
      .filter((b) => b.type === 'other')
      .reduce((s, b) => s + (b.cost ?? 0), 0);
    return [
      { label: 'Voos', icon: '✈️', amount: flights, type: 'flight' },
      { label: 'Alojamento', icon: '🏨', amount: hotels, type: 'hotel' },
      { label: 'Atividades', icon: '🎫', amount: this.totalSpentPlaces, type: 'place' },
      { label: 'Transportes', icon: '🚌', amount: transport, type: 'bus' },
      { label: 'Outros', icon: '📦', amount: other, type: 'other' },
    ];
  }

  dayCost(day: { items: DayItem[]; dateStr: string }): number {
    const placesCost = day.items
      .filter((i) => i.type === 'place')
      .reduce((s, i) => s + ((i.data as Place).cost ?? 0), 0);
    const bookingsCost = this.bookingsForDay(day).reduce((s, b) => s + (b.cost ?? 0), 0);
    return placesCost + bookingsCost;
  }

  formatCost(amount: number): string {
    if (amount === 0) return '';
    return `${this.currencySymbol}${amount.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  get progressPercent(): number {
    if (this.days.length === 0) return 0;
    const planned = this.days.filter((d) => d.items.some((i) => i.type === 'place')).length;
    return Math.round((planned / this.days.length) * 100);
  }

  get progressDaysLabel(): string {
    const planned = this.days.filter((d) => d.items.some((i) => i.type === 'place')).length;
    return `${planned} de ${this.days.length} dias planeados`;
  }

  daySummary(day: { items: DayItem[]; dateStr: string }): string {
    const placeCount = day.items.filter((i) => i.type === 'place').length;
    const parts: string[] = [];
    if (placeCount > 0) parts.push(`${placeCount} ${placeCount === 1 ? 'local' : 'locais'}`);
    const bookings = this.bookingsForDay(day);
    const byType: Record<string, number> = {};
    for (const b of bookings) byType[b.type] = (byType[b.type] ?? 0) + 1;
    const icons: Record<string, string> = {
      flight: '\u2708\uFE0F',
      hotel: '\uD83C\uDFE8',
      bus: '\uD83D\uDE8C',
      other: '\uD83D\uDCDD',
    };
    for (const [type, count] of Object.entries(byType)) {
      parts.push(`${count} ${icons[type] ?? '\uD83D\uDCDD'}`);
    }
    return parts.join(' \u00B7 ') || 'Sem plano';
  }

  async saveDayNote(dayNumber: number): Promise<void> {
    if (!this.itineraryId) return;
    const key = `day-note-${dayNumber}`;
    const current = this.dayNotes[dayNumber] ?? '';
    const original = this.originalDayNotes[dayNumber] ?? '';
    if (current === original) {
      this.dirty.clearWrite(key);
    } else {
      const snapshot = { ...this.dayNotes };
      this.dirty.markWrite(key, () =>
        this.firebaseService.updateItinerary(this.itineraryId, { dayNotes: snapshot }),
      );
    }
  }

  bookingsForDay(day: { dateStr: string }): Booking[] {
    if (!day.dateStr) return [];
    return this.bookings.filter((b) => b.date === day.dateStr);
  }

  get unscheduledBookings(): Booking[] {
    return this.bookings.filter((b) => !b.date);
  }

  bookingIcon(type: string): string {
    const icons: Record<string, string> = {
      flight: '✈️',
      hotel: '🏨',
      bus: '🚌',
      other: '📝',
    };
    return icons[type] ?? '📝';
  }

  get mapPlaces(): MapPlace[] {
    return this.allPlaces.map((p) => {
      const assignedDayObj = this.days.find((d) =>
        d.items.some((i) => i.type === 'place' && (i.data as Place).id === p.id),
      );
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

  // Persist the orderIndex of every item in a column after a reorder.
  private persistColumnOrder(items: DayItem[]): void {
    items.forEach((item, idx) => {
      if (item.type === 'place') {
        const p = item.data as Place;
        if (!p.id) return;
        if ((p.orderIndex ?? 0) === idx) {
          this.dirty.clearWrite(`place-order-${p.id}`);
        } else {
          this.dirty.markWrite(`place-order-${p.id}`, () =>
            this.firebaseService.updatePlace(p.itineraryId!, p.countryId!, p.cityId, p.id!, {
              orderIndex: idx,
            }),
          );
        }
      } else {
        const n = item.data as StickyNote;
        if (!n.id) return;
        if ((n.orderIndex ?? 0) === idx) {
          this.dirty.clearWrite(`note-order-${n.id}`);
        } else {
          this.dirty.markWrite(`note-order-${n.id}`, () =>
            this.firebaseService.updateStickyNote(this.itineraryId, n.id!, { orderIndex: idx }),
          );
        }
      }
    });
  }

  drop(event: CdkDragDrop<DayItem[]>, targetDay: number | null): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.persistColumnOrder(event.container.data);
      return;
    }

    const rawItem = (event.previousContainer.data as unknown[])[event.previousIndex];
    const isDayItem =
      rawItem !== null && typeof rawItem === 'object' && 'type' in (rawItem as object);

    if (isDayItem) {
      const dayItem = rawItem as DayItem;

      if (targetDay === null && dayItem.type === 'note') {
        // Prevent notes being dropped into the unassign zone — silently ignore.
        return;
      }

      if (targetDay === null) {
        // Dragging a place from a day column back to the unassign zone.
        (event.previousContainer.data as unknown[]).splice(event.previousIndex, 1);
        (event.container.data as unknown[]).splice(event.currentIndex, 0, dayItem);
        this.persistColumnOrder(event.previousContainer.data);
        const p = dayItem.data as Place;
        if (p.id) {
          if ((p.assignedDay ?? null) === null) {
            this.dirty.clearWrite(`place-day-${p.id}`);
          } else {
            this.dirty.markWrite(`place-day-${p.id}`, () =>
              this.firebaseService.updatePlaceDay(p, null),
            );
          }
        }
      } else {
        // Dragging a DayItem from one day to another.
        transferArrayItem(
          event.previousContainer.data,
          event.container.data,
          event.previousIndex,
          event.currentIndex,
        );
        this.persistColumnOrder(event.previousContainer.data);
        this.persistColumnOrder(event.container.data);
        if (dayItem.type === 'place') {
          const p = dayItem.data as Place;
          if (p.id) {
            if ((p.assignedDay ?? null) === targetDay) {
              this.dirty.clearWrite(`place-day-${p.id}`);
            } else {
              this.dirty.markWrite(`place-day-${p.id}`, () =>
                this.firebaseService.updatePlaceDay(p, targetDay),
              );
            }
          }
        } else {
          const n = dayItem.data as StickyNote;
          if (n.id) {
            if ((n.assignedDay ?? null) === targetDay) {
              this.dirty.clearWrite(`note-day-${n.id}`);
            } else {
              this.dirty.markWrite(`note-day-${n.id}`, () =>
                this.firebaseService.updateStickyNote(this.itineraryId, n.id!, {
                  assignedDay: targetDay,
                }),
              );
            }
          }
        }
      }
    } else {
      // Dragging a raw Place from the sidebar wishlist into a day column.
      const place = rawItem as Place;
      (event.previousContainer.data as unknown[]).splice(event.previousIndex, 1);
      const wrapped: DayItem = { type: 'place', data: place };
      event.container.data.splice(event.currentIndex, 0, wrapped);
      this.persistColumnOrder(event.container.data);
      if (place.id) {
        if ((place.assignedDay ?? null) === targetDay) {
          this.dirty.clearWrite(`place-day-${place.id}`);
        } else {
          this.dirty.markWrite(`place-day-${place.id}`, () =>
            this.firebaseService.updatePlaceDay(place, targetDay),
          );
        }
      }
    }
  }
}
