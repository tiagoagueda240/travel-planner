import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Place } from '../../../models/models';
import { ImagePickerComponent } from '../../shared/image-picker/image-picker';

@Component({
  selector: 'app-add-place-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImagePickerComponent],
  templateUrl: './add-place-modal.html',
  styleUrls: ['./add-place-modal.scss'],
})
export class AddPlaceModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject<DialogRef<Place>>(DialogRef);
  readonly data = inject<{ cityId: string; place?: Place }>(DIALOG_DATA);

  placeForm!: FormGroup;
  isEditing = false;

  ngOnInit(): void {
    this.isEditing = !!this.data.place;

    this.placeForm = this.fb.group({
      id: [this.data.place?.id ?? null],
      cityId: [this.data.place?.cityId ?? this.data.cityId],
      name: [this.data.place?.name ?? '', [Validators.required, Validators.minLength(2)]],
      imageUrl: [this.data.place?.imageUrl ?? ''],
      link: [this.data.place?.link ?? ''],
      assignedDay: [this.data.place?.assignedDay ?? null],
      orderIndex: [this.data.place?.orderIndex ?? 0],
    });
  }

  onSubmit(): void {
    if (this.placeForm.valid) {
      this.dialogRef.close(this.placeForm.value);
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
