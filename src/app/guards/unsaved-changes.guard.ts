import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmDialogService } from '../services/confirm-dialog';
import { DirtyStateService } from '../services/dirty-state';

export const unsavedChangesGuard: CanDeactivateFn<unknown> = async () => {
  const dirty = inject(DirtyStateService);
  const dialogs = inject(ConfirmDialogService);

  if (!dirty.isDirty) return true;

  const choice = await dialogs.confirm({
    title: 'Alterações por guardar',
    message: 'Tens alterações que ainda não foram guardadas. O que queres fazer?',
    confirmLabel: '💾 Guardar e sair',
    secondaryLabel: 'Sair sem guardar',
    cancelLabel: 'Continuar a editar',
  });

  if (choice === 'confirm') {
    try {
      await dirty.save();
    } catch {
      const leaveAnyway = await dialogs.confirm({
        title: 'Erro ao guardar',
        message: 'Não foi possível guardar as alterações. Queres sair mesmo assim?',
        confirmLabel: 'Sair sem guardar',
        cancelLabel: 'Ficar na página',
        confirmDanger: true,
      });
      if (leaveAnyway === 'confirm') dirty.discard();
      return leaveAnyway === 'confirm';
    }
    return true;
  }

  if (choice === 'secondary') {
    dirty.discard();
    return true;
  }

  // 'cancel' — stay on page
  return false;
};
