import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DirtyStateService {
  private readonly _isDirty$ = new BehaviorSubject(false);
  readonly isDirty$ = this._isDirty$.asObservable();

  /** key → latest write function (last one wins, deduplication per entity) */
  private readonly queue = new Map<string, () => Promise<void>>();

  readonly isSaving$ = new BehaviorSubject(false);

  private readonly beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    if (this._isDirty$.value) {
      e.preventDefault();
    }
  };

  constructor() {
    // providedIn: 'root' — lives for the entire app lifetime, listener is intentional.
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  /**
   * Queue a write operation. Multiple calls with the same key replace the previous one,
   * so rapidly repeating operations (e.g. drag-drop) only send one request.
   */
  markWrite(key: string, fn: () => Promise<void>): void {
    this.queue.set(key, fn);
    this._isDirty$.next(true);
  }

  /**
   * Cancel a previously queued write for the given key (e.g. when a drag is undone).
   * If this empties the queue, the dirty flag is cleared automatically.
   */
  clearWrite(key: string): void {
    this.queue.delete(key);
    if (this.queue.size === 0) {
      this._isDirty$.next(false);
    }
  }

  get isDirty(): boolean {
    return this._isDirty$.value;
  }

  /** Flush all pending writes to Firebase. */
  async save(): Promise<void> {
    if (!this._isDirty$.value || this.isSaving$.value) return;
    this.isSaving$.next(true);

    // Snapshot only the keys queued at this moment.
    // New writes that arrive during save are preserved in the queue.
    const keysToFlush = [...this.queue.keys()];
    const ops = keysToFlush.map((k) => this.queue.get(k)!);

    try {
      await Promise.all(ops.map((fn) => fn()));
      // Only remove the keys that were part of this flush — new writes remain.
      keysToFlush.forEach((k) => this.queue.delete(k));
      if (this.queue.size === 0) this._isDirty$.next(false);
    } catch {
      // Queue is untouched — user can retry. Re-asserts dirty flag in case it was cleared.
      this._isDirty$.next(true);
      throw new Error('Alguns dados não foram guardados. Tenta novamente.');
    } finally {
      this.isSaving$.next(false);
    }
  }

  /** Discard all pending writes (used when user chooses not to save). */
  discard(): void {
    this.queue.clear();
    this._isDirty$.next(false);
  }
}
