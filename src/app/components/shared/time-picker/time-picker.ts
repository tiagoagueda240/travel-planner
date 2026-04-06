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

@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './time-picker.html',
  styleUrls: ['./time-picker.scss'],
})
export class TimePickerComponent implements OnChanges {
  @Input() value = '';
  @Input() placeholder = 'Selecionar';
  @Output() valueChange = new EventEmitter<string>();

  constructor(private readonly elRef: ElementRef) {}

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (this.showPanel && !this.elRef.nativeElement.contains(target as Node)) {
      this.showPanel = false;
    }
  }

  showPanel = false;
  selectedHour = -1;
  selectedMinute = -1;

  readonly hours: string[] = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  readonly minutes: string[] = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  get displayValue(): string {
    if (this.selectedHour < 0 || this.selectedMinute < 0) return this.placeholder;
    return `${this.selectedHourStr}:${this.selectedMinuteStr}`;
  }

  get selectedHourStr(): string {
    return this.selectedHour >= 0 ? String(this.selectedHour).padStart(2, '0') : '';
  }

  get selectedMinuteStr(): string {
    return this.selectedMinute >= 0 ? String(this.selectedMinute).padStart(2, '0') : '';
  }

  ngOnChanges(): void {
    if (this.value && /^\d{2}:\d{2}$/.test(this.value)) {
      const [h, m] = this.value.split(':').map(Number);
      this.selectedHour = h;
      const rounded = Math.round(m / 5) * 5;
      this.selectedMinute = rounded >= 60 ? 55 : rounded;
    } else {
      this.selectedHour = -1;
      this.selectedMinute = -1;
    }
  }

  openPanel(): void {
    this.showPanel = true;
  }

  closePanel(event?: Event): void {
    event?.stopPropagation();
    this.showPanel = false;
  }

  selectHour(h: string, event: Event): void {
    event.stopPropagation();
    this.selectedHour = parseInt(h, 10);
    this.emitIfComplete();
  }

  selectMinute(m: string, event: Event): void {
    event.stopPropagation();
    this.selectedMinute = parseInt(m, 10);
    this.emitIfComplete();
    if (this.selectedHour >= 0) {
      this.closePanel();
    }
  }

  private emitIfComplete(): void {
    if (this.selectedHour >= 0 && this.selectedMinute >= 0) {
      const v = `${String(this.selectedHour).padStart(2, '0')}:${String(this.selectedMinute).padStart(2, '0')}`;
      this.valueChange.emit(v);
    }
  }
}
