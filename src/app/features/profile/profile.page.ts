import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage, fieldErrors } from '@core/http/api-error';
import { AVATAR_COLORS, AVATAR_ICONS, Avatar, AvatarColor, formatAvatar, parseAvatar } from '@ui/domain/avatar/avatar';
import { ProfileStore } from '@data/profile/profile.store';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { matching } from '../auth/matching.validator';

type Feedback = { tone: 'success' | 'danger'; text: string } | null;

/**
 * The signed-in user's account. Everyone can change their password; UsersService only lets
 * manage_users read or edit user records, so username/e-mail are editable only with that permission.
 */
@Component({
  selector: 'eras-profile-page',
  imports: [ReactiveFormsModule, PageComponent, GridComponent, CardComponent, StackComponent, SectionHeaderComponent, FormFieldComponent, AlertComponent, ButtonComponent, SpinnerComponent, AvatarComponent, IconComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly username = computed(() => this.auth.user()?.username ?? '');

  // ── Player icon (shown beside the name in the simulator) ───────────────
  protected readonly profile = inject(ProfileStore);
  protected readonly avatarIcons = AVATAR_ICONS;
  protected readonly avatarColors = AVATAR_COLORS;
  protected readonly avatarDraft = signal<Avatar>(parseAvatar(null));
  protected readonly avatarDraftValue = computed(() => formatAvatar(this.avatarDraft()));
  protected readonly avatarChanged = computed(() => this.avatarDraftValue() !== formatAvatar(parseAvatar(this.profile.avatar())));
  protected readonly avatarFeedback = signal<Feedback>(null);
  protected readonly canEditAccount = computed(() => this.auth.can('manage_users'));

  // ── Account (manage_users) ─────────────────────────────────────────────
  protected readonly accountLoading = signal(false);
  protected readonly accountSaving = signal(false);
  protected readonly accountFeedback = signal<Feedback>(null);
  protected readonly accountForm = this.fb.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  // ── Password ───────────────────────────────────────────────────────────
  protected readonly passwordSaving = signal(false);
  protected readonly passwordFeedback = signal<Feedback>(null);
  protected readonly newPasswordServerError = signal<string | null>(null);
  protected readonly passwordForm = this.fb.group(
    {
      oldPassword: ['', Validators.required],
      newPassword: ['', Validators.required],
      confirm: ['', Validators.required],
    },
    { validators: matching('newPassword', 'confirm') },
  );

  constructor() {
    if (this.canEditAccount()) void this.loadAccount();
    // The saved icon is where the choice starts (and comes back to once it is saved)
    effect(() => {
      const saved = this.profile.avatar();
      untracked(() => this.avatarDraft.set(parseAvatar(saved)));
    });
  }

  protected pickIcon(icon: IconName): void {
    this.avatarDraft.update((a) => ({ ...a, icon }));
    this.avatarFeedback.set(null);
  }

  protected pickColor(color: AvatarColor): void {
    this.avatarDraft.update((a) => ({ ...a, color }));
    this.avatarFeedback.set(null);
  }

  protected async saveAvatar(): Promise<void> {
    try {
      await this.profile.saveAvatar(this.avatarDraftValue());
      this.avatarFeedback.set({ tone: 'success', text: 'Ícono guardado. Se verá en tus próximas partidas.' });
    } catch (e) {
      this.avatarFeedback.set({ tone: 'danger', text: apiErrorMessage(e, 'No se pudo guardar el ícono') });
    }
  }

  private async loadAccount(): Promise<void> {
    this.accountLoading.set(true);
    try {
      const me = await this.auth.loadOwnAccount();
      this.accountForm.setValue({ username: me?.username ?? this.username(), email: me?.email ?? '' });
    } catch (e) {
      this.accountFeedback.set({ tone: 'danger', text: apiErrorMessage(e, 'No se pudo cargar tu cuenta') });
    } finally {
      this.accountLoading.set(false);
    }
  }

  protected async saveAccount(): Promise<void> {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }
    this.accountSaving.set(true);
    this.accountFeedback.set(null);
    const { username, email } = this.accountForm.getRawValue();
    try {
      await this.auth.updateOwnAccount({ username: username.trim(), email: email.trim() });
      this.accountFeedback.set({ tone: 'success', text: 'Cuenta actualizada' });
    } catch (e) {
      this.accountFeedback.set({ tone: 'danger', text: apiErrorMessage(e, 'No se pudo actualizar la cuenta') });
    } finally {
      this.accountSaving.set(false);
    }
  }

  protected passwordError(field: 'oldPassword' | 'newPassword' | 'confirm'): string | null {
    if (field === 'newPassword' && this.newPasswordServerError()) return this.newPasswordServerError();
    const control = this.passwordForm.controls[field];
    if (!control.touched) return null;
    if (control.hasError('required')) {
      return { oldPassword: 'Ingresa tu contraseña actual', newPassword: 'Ingresa la nueva contraseña', confirm: 'Repite la nueva contraseña' }[field];
    }
    if (field === 'confirm' && this.passwordForm.hasError('mismatch')) return 'Las contraseñas no coinciden';
    return null;
  }

  protected async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.passwordSaving.set(true);
    this.passwordFeedback.set(null);
    this.newPasswordServerError.set(null);
    const { oldPassword, newPassword } = this.passwordForm.getRawValue();
    try {
      await this.auth.changePassword(oldPassword, newPassword);
      this.passwordForm.reset();
      this.passwordFeedback.set({ tone: 'success', text: 'Contraseña actualizada' });
    } catch (e) {
      const fields = fieldErrors(e);
      if (fields['newPassword']) this.newPasswordServerError.set(fields['newPassword']);
      else this.passwordFeedback.set({ tone: 'danger', text: apiErrorMessage(e, 'No se pudo cambiar la contraseña') });
    } finally {
      this.passwordSaving.set(false);
    }
  }
}
