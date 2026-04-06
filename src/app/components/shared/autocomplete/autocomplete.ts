import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { GeoService, PlaceSuggestion } from '../../../services/geo';

@Component({
  selector: 'app-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './autocomplete.html',
  styleUrls: ['./autocomplete.scss'],
})
export class AutocompleteComponent implements OnInit, OnChanges, OnDestroy {
  private readonly geo = inject(GeoService);
  private readonly el = inject(ElementRef);

  /** 'country' | 'city' | 'place' | 'location' | 'airport' | 'hotel' */
  @Input() mode: 'country' | 'city' | 'place' | 'location' | 'airport' | 'hotel' = 'country';
  /** Para mode='city': nome do país selecionado */
  @Input() countryContext = '';
  @Input() value = '';
  @Input() placeholder = '';
  @Output() valueChange = new EventEmitter<string>();
  /** Emitido quando o utilizador confirma uma sugestão (string) */
  @Output() selected = new EventEmitter<string>();
  /** Emitido apenas em mode='place', com coordenadas incluídas */
  @Output() placePicked = new EventEmitter<PlaceSuggestion>();

  suggestions: string[] = [];
  filtered: string[] = [];
  open = false;
  loading = false;
  activeIndex = -1;

  private placeMap = new Map<string, PlaceSuggestion>();
  private input$ = new Subject<string>();
  private sub = new Subscription();

  ngOnInit(): void {
    if (
      this.mode === 'place' ||
      this.mode === 'location' ||
      this.mode === 'airport' ||
      this.mode === 'hotel'
    ) {
      // Pesquisa remota ao escrever
      this.sub.add(
        this.input$
          .pipe(
            debounceTime(350),
            distinctUntilChanged(),
            switchMap((q) => {
              if (q.trim().length < 2) {
                this.filtered = [];
                this.open = false;
                this.loading = false;
                return [];
              }
              this.loading = true;
              if (this.mode === 'place') return this.geo.searchPlacesByName(q);
              if (this.mode === 'airport') return this.geo.searchAirports(q);
              if (this.mode === 'hotel') return this.geo.searchHotels(q);
              return this.geo.searchLocation(q);
            }),
          )
          .subscribe({
            next: (places) => {
              this.placeMap.clear();
              this.filtered = places.map((p) => {
                this.placeMap.set(p.name, p);
                return p.name;
              });
              this.loading = false;
              this.open = this.filtered.length > 0;
              this.activeIndex = -1;
            },
            error: () => {
              this.loading = false;
            },
          }),
      );
    } else {
      this.sub.add(
        this.input$
          .pipe(debounceTime(180), distinctUntilChanged())
          .subscribe((q) => this.filter(q)),
      );
      this.loadSuggestions();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['countryContext'] && !changes['countryContext'].firstChange) {
      this.suggestions = [];
      this.filtered = [];
      this.loadSuggestions();
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.el.nativeElement.contains(e.target)) this.close();
  }

  onInput(val: string): void {
    this.valueChange.emit(val);
    this.open = true;
    this.activeIndex = -1;
    this.input$.next(val);
  }

  onKeydown(e: KeyboardEvent): void {
    if (!this.open || this.filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, this.filtered.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, -1);
    } else if (e.key === 'Enter' && this.activeIndex >= 0) {
      e.preventDefault();
      this.pick(this.filtered[this.activeIndex]);
    } else if (e.key === 'Escape') {
      this.close();
    }
  }

  pick(name: string): void {
    this.valueChange.emit(name);
    this.selected.emit(name);
    if (
      this.mode === 'place' ||
      this.mode === 'location' ||
      this.mode === 'airport' ||
      this.mode === 'hotel'
    ) {
      const suggestion = this.placeMap.get(name);
      if (suggestion) this.placePicked.emit(suggestion);
    }
    this.filtered = [];
    this.open = false;
    this.activeIndex = -1;
  }

  private filter(q: string): void {
    const term = q.trim().toLowerCase();
    if (!term) {
      this.filtered = [];
      return;
    }
    this.filtered = this.suggestions.filter((s) => s.toLowerCase().includes(term)).slice(0, 8);
  }

  private close(): void {
    this.open = false;
    this.filtered = [];
  }

  private loadSuggestions(): void {
    if (this.mode === 'country') {
      this.loading = true;
      this.sub.add(
        this.geo.getCountries().subscribe((list) => {
          this.suggestions = list;
          this.loading = false;
        }),
      );
    } else if (this.mode === 'city' && this.countryContext) {
      this.loading = true;
      this.sub.add(
        this.geo.getCities(this.countryContext).subscribe((list) => {
          this.suggestions = list;
          this.loading = false;
          if (this.value) this.filter(this.value);
        }),
      );
    }
  }
}
