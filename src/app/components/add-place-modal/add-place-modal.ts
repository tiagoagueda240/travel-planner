import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { Place } from '../../models/models';

@Component({
  selector: 'app-add-place-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-place-modal.html',
  styleUrls: ['./add-place-modal.scss']
})
export class AddPlaceModalComponent implements OnInit {
  placeForm!: FormGroup;
  isEditing = false;

  constructor(
    private fb: FormBuilder,
    public dialogRef: DialogRef<Place>, // Tipamos o retorno com a interface Place
    @Inject(DIALOG_DATA) public data: { cityId: string, place?: Place } // Recebemos os dados
  ) { }

  ngOnInit(): void {
    this.isEditing = !!this.data.place;

    this.placeForm = this.fb.group({
      id: [this.data.place?.id || null],
      cityId: [this.data.place?.cityId || this.data.cityId],
      name: [this.data.place?.name || '', [Validators.required, Validators.minLength(2)]],
      imageUrl: [this.data.place?.imageUrl || '', Validators.required],
      link: [this.data.place?.link || ''],
      assignedDay: [this.data.place?.assignedDay || null],
      orderIndex: [this.data.place?.orderIndex || 0]
    });
  }

  onSubmit() {
    if (this.placeForm.valid) {
      // Retorna os dados do formulário de volta para quem abriu o modal
      this.dialogRef.close(this.placeForm.value);
    }
  }

  onClose() {
    this.dialogRef.close(); // Retorna undefined se for cancelado
  }
}