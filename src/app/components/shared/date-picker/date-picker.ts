import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
} from '@angular/core';

type CalendarDay = {
  dayNumber: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
};

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-picker.html',
  styleUrls: ['./date-picker.scss'],
})
export class DatePickerComponent implements OnChanges {
  @Input() value = '';
  @Input() placeholder = 'Selecionar';
  @Output() valueChange = new EventEmitter<string>();

  constructor(private readonly elRef: ElementRef) {}

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (this.showCalendar && !this.elRef.nativeElement.contains(target as Node)) {
      this.showCalendar = false;
    }
  }

  showCalendar = false;
  currentMonthDate = new Date();
  calendarDays: CalendarDay[] = [];
  readonly weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  private _value = '';

  get displayValue(): string {
    return this._value;
  }

  ngOnChanges(): void {
    this._value = this.value;
  }

  openCalendar(): void {
    this.showCalendar = true;
    const ref = this._value ? new Date(this._value + 'T12:00:00') : new Date();
    this.currentMonthDate = new Date(ref.getFullYear(), ref.getMonth(), 1);
    this.generateCalendar();
  }

  closeCalendar(): void {
    this.showCalendar = false;
  }

  selectDate(day: CalendarDay, event: Event): void {
    event.stopPropagation();
    this._value = day.dateStr;
    this.valueChange.emit(this._value);
    this.closeCalendar();
    this.generateCalendar();
  }

  changeMonth(delta: number, event: Event): void {
    event.stopPropagation();
    this.currentMonthDate = new Date(
      this.currentMonthDate.getFullYear(),
      this.currentMonthDate.getMonth() + delta,
      1,
    );
    this.generateCalendar();
  }

  generateCalendar(): void {
    const year = this.currentMonthDate.getFullYear();
    const month = this.currentMonthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    this.calendarDays = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      this.calendarDays.push(this.makeDay(new Date(year, month, -i), false));
    }
    for (let i = 1; i <= daysInMonth; i++) {
      this.calendarDays.push(this.makeDay(new Date(year, month, i), true));
    }
    for (let i = 1; i <= 42 - this.calendarDays.length; i++) {
      this.calendarDays.push(this.makeDay(new Date(year, month + 1, i), false));
    }
  }

  private makeDay(date: Date, isCurrentMonth: boolean): CalendarDay {
    const dateStr = this.toDateStr(date);
    return {
      dayNumber: date.getDate(),
      dateStr,
      isCurrentMonth,
      isSelected: dateStr === this._value,
    };
  }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  formatDate(d: string): string {
    if (!d) return this.placeholder;
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(d + 'T12:00:00'));
  }

  get monthYearLabel(): string {
    return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(
      this.currentMonthDate,
    );
  }
}
