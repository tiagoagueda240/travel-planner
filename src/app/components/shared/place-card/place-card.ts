import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { Place } from '../../../models/models';

@Component({
  selector: 'app-place-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './place-card.html',
  styleUrls: ['./place-card.scss'],
})
export class PlaceCardComponent {
  private sanitizer = inject(DomSanitizer);

  @Input() place!: Place;
  @Input() compact = false;
  @Input() showDelete = true;

  @Output() edit = new EventEmitter<Place>();
  @Output() delete = new EventEmitter<string>();
  @Output() unassign = new EventEmitter<Place>();

  confirmingDelete = false;
  lightboxOpen = false;
  private confirmTimer: ReturnType<typeof setTimeout> | null = null;

  openLightbox() {
    if (this.place.imageUrl) this.lightboxOpen = true;
  }

  closeLightbox() {
    this.lightboxOpen = false;
  }

  get cardImageStyle(): SafeStyle {
    const url = this.place.imageUrl;
    // Strict whitelist: only https, no whitespace or CSS special characters
    if (url && /^https:\/\/[^\s"'()\\]+$/.test(url)) {
      return this.sanitizer.bypassSecurityTrustStyle(`url("${url}")`);
    }
    return '';
  }

  onEdit() {
    this.edit.emit(this.place);
  }

  onDelete() {
    if (!this.confirmingDelete) {
      this.confirmingDelete = true;
      this.confirmTimer = setTimeout(() => {
        this.confirmingDelete = false;
      }, 3000);
    } else {
      if (this.confirmTimer) clearTimeout(this.confirmTimer);
      this.delete.emit(this.place.id);
      this.confirmingDelete = false;
    }
  }

  cancelDelete() {
    if (this.confirmTimer) clearTimeout(this.confirmTimer);
    this.confirmingDelete = false;
  }
}
