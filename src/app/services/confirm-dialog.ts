import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type DialogResult = 'confirm' | 'secondary' | 'cancel';

export interface ConfirmDialogState {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  secondaryLabel: string | null;
  cancelLabel: string;
  confirmDanger: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private resolver: ((val: DialogResult) => void) | null = null;

  readonly state$ = new BehaviorSubject<ConfirmDialogState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    secondaryLabel: null,
    cancelLabel: 'Cancelar',
    confirmDanger: false,
  });

  confirm(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    secondaryLabel?: string;
    cancelLabel?: string;
    confirmDanger?: boolean;
  }): Promise<DialogResult> {
    this.state$.next({
      visible: true,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      secondaryLabel: options.secondaryLabel ?? null,
      cancelLabel: options.cancelLabel ?? 'Cancelar',
      confirmDanger: options.confirmDanger ?? false,
    });
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  resolve(value: DialogResult): void {
    this.resolver?.(value);
    this.resolver = null;
    this.state$.next({ ...this.state$.value, visible: false });
  }
}
