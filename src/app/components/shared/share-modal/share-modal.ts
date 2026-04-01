import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Itinerary } from '../../../models/models';
import { FirebaseService } from '../../../services/firebase';
import { ToastService } from '../../../services/toast';

@Component({
  selector: 'app-share-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './share-modal.html',
  styleUrls: ['./share-modal.scss'],
})
export class ShareModalComponent implements OnChanges {
  @Input() itinerary!: Itinerary;
  @Input() isOwner = false;
  @Output() closed = new EventEmitter<void>();

  private readonly firebase = inject(FirebaseService);
  private readonly toast = inject(ToastService);

  activeTab: 'colaboradores' | 'link' = 'colaboradores';
  newCollaboratorEmail = '';
  isLoading = false;
  shareUrl = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['itinerary'] && this.itinerary?.shareToken) {
      this.shareUrl = this.buildShareUrl(this.itinerary.shareToken);
    }
  }

  get collaborators(): string[] {
    return this.itinerary?.collaborators ?? [];
  }

  async addCollaborator(): Promise<void> {
    const email = this.newCollaboratorEmail.toLowerCase().trim();
    if (!email || !this.validateEmail(email)) {
      this.toast.show('Introduz um email válido.', 'error');
      return;
    }
    if (this.collaborators.includes(email)) {
      this.toast.show('Este email já foi convidado.', 'error');
      return;
    }
    this.isLoading = true;
    try {
      await this.firebase.addCollaborator(this.itinerary.id!, email);
      this.newCollaboratorEmail = '';
      this.toast.show('Colaborador convidado com sucesso!', 'success');
    } catch {
      this.toast.show('Erro ao convidar colaborador.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async removeCollaborator(email: string): Promise<void> {
    this.isLoading = true;
    try {
      await this.firebase.removeCollaborator(this.itinerary.id!, email);
      this.toast.show('Colaborador removido.', 'success');
    } catch {
      this.toast.show('Erro ao remover colaborador.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async generateLink(): Promise<void> {
    this.isLoading = true;
    try {
      const token = await this.firebase.generateShareToken(this.itinerary.id!);
      this.shareUrl = this.buildShareUrl(token);
      this.toast.show('Link gerado com sucesso!', 'success');
    } catch {
      this.toast.show('Erro ao gerar link.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async revokeLink(): Promise<void> {
    this.isLoading = true;
    try {
      await this.firebase.revokeShareToken(this.itinerary.id!);
      this.shareUrl = '';
      this.toast.show('Link revogado.', 'success');
    } catch {
      this.toast.show('Erro ao revogar link.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareUrl).then(() => {
      this.toast.show('Link copiado!', 'success');
    });
  }

  close(): void {
    this.closed.emit();
  }

  private buildShareUrl(token: string): string {
    return `${window.location.origin}/partilha/${token}`;
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
