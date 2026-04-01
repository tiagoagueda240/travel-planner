import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { DateRange } from '../../../models/models';

type CalendarDay = {
  dayNumber: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isStart: boolean;
  isEnd: boolean;
  isBetween: boolean;
};

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-range-picker.html',
  styleUrls: ['./date-range-picker.scss'],
})
export class DateRangePickerComponent implements OnChanges {
  @Input() startDate = '';
  @Input() endDate = '';
  @Output() rangeChange = new EventEmitter<DateRange>();

  showCalendar = false;
  selectingType: 'start' | 'end' = 'start';
  currentMonthDate = new Date();
  calendarDays: CalendarDay[] = [];
  readonly weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  private _start = '';
  private _end = '';

  get displayStart() {
    return this._start;
  }
  get displayEnd() {
    return this._end;
  }

  ngOnChanges() {
    this._start = this.startDate;
    this._end = this.endDate;
  }

  openCalendar(type: 'start' | 'end') {
    this.selectingType = type;
    this.showCalendar = true;
    const ref = type === 'start' && this._start ? new Date(this._start + 'T12:00:00') : new Date();
    this.currentMonthDate = new Date(ref.getFullYear(), ref.getMonth(), 1);
    this.generateCalendar();
  }

  closeCalendar() {
    this.showCalendar = false;
  }

  selectDate(day: CalendarDay) {
    if (this.selectingType === 'start') {
      this._start = day.dateStr;
      this._end = '';
      this.selectingType = 'end';
    } else {
      if (day.dateStr < this._start) {
        this._end = this._start;
        this._start = day.dateStr;
      } else {
        this._end = day.dateStr;
      }
      this.closeCalendar();
      this.rangeChange.emit({ startDate: this._start, endDate: this._end });
    }
    this.generateCalendar();
  }

  changeMonth(delta: number) {
    this.currentMonthDate = new Date(
      this.currentMonthDate.getFullYear(),
      this.currentMonthDate.getMonth() + delta,
      1,
    );
    this.generateCalendar();
  }

  generateCalendar() {
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
      isStart: dateStr === this._start,
      isEnd: dateStr === this._end,
      isBetween: !!(this._start && this._end && dateStr > this._start && dateStr < this._end),
    };
  }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  formatDate(d: string): string {
    if (!d) return 'Selecionar';
    return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' }).format(
      new Date(d + 'T12:00:00'),
    );
  }

  get monthYearLabel(): string {
    return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(
      this.currentMonthDate,
    );
  }
}
