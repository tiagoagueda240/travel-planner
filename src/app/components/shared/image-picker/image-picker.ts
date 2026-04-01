import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

interface PexelsPhoto {
  id: number;
  alt: string;
  src: { tiny: string; large: string };
}

@Component({
  selector: 'app-image-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-picker.html',
  styleUrls: ['./image-picker.scss'],
})
export class ImagePickerComponent {
  private readonly http = inject(HttpClient);
  private readonly el = inject(ElementRef);

  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();
  /** Texto usado como pesquisa automática ao abrir o painel */
  @Input() hint = '';
  /** Quando true, o picker não é clicavel */
  @Input() disabled = false;

  panelOpen = false;
  query = '';
  results: PexelsPhoto[] = [];
  loading = false;
  searched = false;
  error = false;

  /** Último hint com que fizemos auto-search, para não sobrescrever queries manuais */
  private lastAutoHint = '';

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.panelOpen = false;
    }
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.panelOpen = !this.panelOpen;
    // Auto-pesquisa ao abrir se o hint mudou ou o query ainda é o auto-hint anterior
    if (this.panelOpen && this.hint && (this.query === this.lastAutoHint || !this.query)) {
      this.lastAutoHint = this.hint;
      this.query = this.hint;
      this.search();
    }
  }

  search(): void {
    const q = this.query.trim();
    if (!q) return;
    this.loading = true;
    this.results = [];
    this.error = false;
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`;
    this.http
      .get<{ photos: PexelsPhoto[] }>(url, {
        headers: { Authorization: environment.pexelsApiKey },
      })
      .subscribe({
        next: (res) => {
          this.results = res.photos;
          this.loading = false;
          this.searched = true;
        },
        error: () => {
          this.loading = false;
          this.searched = true;
          this.error = true;
        },
      });
  }

  pick(photo: PexelsPhoto, event: MouseEvent): void {
    event.stopPropagation();
    this.valueChange.emit(photo.src.large);
    this.panelOpen = false;
  }

  clear(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.valueChange.emit('');
    this.results = [];
    this.searched = false;
    this.query = '';
  }
}
