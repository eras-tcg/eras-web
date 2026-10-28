import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { Permission } from './auth.model';
import { AuthService } from './auth.service';

/** Permissions that edit shared platform content; holding any of them shows the edit-mode switch. */
export const EDIT_PERMISSIONS: Permission[] = ['manage_home', 'manage_editions', 'manage_cards'];

const STORAGE_KEY = 'eras_edit_mode';

/**
 * Global edit mode (switch in the navbar). Edit controls only show while it is on, so content managers
 * browse the site like everyone else until they decide to edit.
 */
@Injectable({ providedIn: 'root' })
export class EditModeService {
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly switchedOn = signal(readSession());
  private readonly dirtyChecks = new Set<() => boolean>();

  /** The user may turn edit mode on. */
  readonly available = computed(() => this.auth.user() !== null && EDIT_PERMISSIONS.some((p) => this.auth.can(p)));
  /** Edit mode is on (and allowed for the current user). */
  readonly active = computed(() => this.available() && this.switchedOn());

  constructor() {
    effect(() => writeSession(this.switchedOn()));
  }

  /** Edit controls for `permission` should be visible. */
  allows(permission: Permission): boolean {
    return this.active() && this.auth.can(permission);
  }

  /**
   * Pages with a draft register a check; turning edit mode off asks before discarding unsaved changes.
   * Returns the unregister function (call it on destroy).
   */
  registerDirty(isDirty: () => boolean): () => void {
    this.dirtyChecks.add(isDirty);
    return () => this.dirtyChecks.delete(isDirty);
  }

  async toggle(): Promise<void> {
    if (!this.switchedOn()) {
      this.switchedOn.set(true);
      return;
    }
    const dirty = [...this.dirtyChecks].some((check) => check());
    if (
      dirty &&
      !(await this.modal.confirm({
        title: 'Salir del modo edición',
        message: 'Hay cambios sin guardar en esta página y se perderán.',
        confirmLabel: 'Descartar y salir',
        danger: true,
      }))
    ) {
      return;
    }
    this.switchedOn.set(false);
  }
}

function readSession(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSession(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable: edit mode lasts until reload
  }
}
