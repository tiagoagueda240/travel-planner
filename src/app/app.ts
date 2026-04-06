import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './components/shared/confirm-dialog/confirm-dialog';
import { ToastComponent } from './components/shared/toast/toast';
import { ConfirmDialogService } from './services/confirm-dialog';
import { DirtyStateService } from './services/dirty-state';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, ConfirmDialogComponent, CommonModule, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly dirty = inject(DirtyStateService);
  private readonly dialogs = inject(ConfirmDialogService);

  @HostListener('document:keydown', ['$event'])
  async onKeydown(e: KeyboardEvent): Promise<void> {
    const isReload = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r');
    if (!isReload || !this.dirty.isDirty) return;

    e.preventDefault();

    const result = await this.dialogs.confirm({
      title: 'Alterações por guardar',
      message: 'Tens alterações que ainda não foram guardadas. O que queres fazer?',
      confirmLabel: '💾 Guardar e recarregar',
      secondaryLabel: 'Recarregar sem guardar',
      cancelLabel: 'Continuar a editar',
    });

    if (result === 'confirm') {
      try {
        await this.dirty.save();
      } catch {
        // save failed — ask again
        const leave = await this.dialogs.confirm({
          title: 'Erro ao guardar',
          message: 'Não foi possível guardar. Recarregar mesmo assim?',
          confirmLabel: 'Recarregar sem guardar',
          cancelLabel: 'Ficar na página',
          confirmDanger: true,
        });
        if (leave !== 'confirm') return;
      }
      window.location.reload();
    } else if (result === 'secondary') {
      this.dirty.discard();
      window.location.reload();
    }
    // 'cancel' → do nothing, stay on page
  }
}
