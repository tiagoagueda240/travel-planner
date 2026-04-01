import { Component, inject } from '@angular/core';
import { ToastService } from '../../../services/toast';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.html',
  styleUrls: ['./toast.scss'],
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
}
