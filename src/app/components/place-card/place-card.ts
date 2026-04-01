import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Place } from '../../models/models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-place-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './place-card.html',
  styleUrls: ['./place-card.scss']
})
export class PlaceCardComponent {
  @Input() place!: Place; // Recebe o local do componente pai

  @Output() edit = new EventEmitter<Place>(); // Avisa o pai que quer editar
  @Output() delete = new EventEmitter<string>(); // Avisa o pai que quer eliminar (envia o ID)

  onEdit() {
    this.edit.emit(this.place);
  }

  onDelete() {
    // Uma confirmação simples antes de apagar
    if (confirm(`Tens a certeza que queres eliminar "${this.place.name}"?`)) {
      this.delete.emit(this.place.id);
    }
  }
}