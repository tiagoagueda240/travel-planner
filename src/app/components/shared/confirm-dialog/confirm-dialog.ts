import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ConfirmDialogService } from '../../../services/confirm-dialog';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './confirm-dialog.html',
  styleUrls: ['./confirm-dialog.scss'],
})
export class ConfirmDialogComponent {
  readonly dialog = inject(ConfirmDialogService);
}
