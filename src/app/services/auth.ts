import { Injectable, inject } from '@angular/core';
import {
  Auth,
  User,
  authState,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth = inject(Auth);

  /**
   * Emits only after Firebase Auth has finished restoring the persisted session.
   * Unlike onAuthStateChanged, authState() waits for the SDK to be ready,
   * preventing guards from reading a false null before auth is initialised.
   */
  readonly user$: Observable<User | null> = authState(this.auth);

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(this.auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
