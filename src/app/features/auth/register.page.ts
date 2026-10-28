import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage, fieldErrors } from '@core/http/api-error';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { AuthLayoutComponent } from '@ui/layout/auth-layout/auth-layout.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { matching } from './matching.validator';

type Field = 'username' | 'email' | 'password';

@Component({
  selector: 'eras-register-page',
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent, StackComponent, FormFieldComponent, AlertComponent, ButtonComponent],
  templateUrl: './register.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Per-field messages from the server's validation. */
  protected readonly serverErrors = signal<Partial<Record<Field, string>>>({});

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirm: ['', Validators.required],
    },
    { validators: matching('password', 'confirm') },
  );

  protected errorFor(field: Field | 'confirm'): string | null {
    const control = this.form.controls[field];
    if (field !== 'confirm' && this.serverErrors()[field]) return this.serverErrors()[field] ?? null;
    if (!control.touched) return null;
    if (control.hasError('required')) {
      return { username: 'Ingresa un nombre de usuario', email: 'Ingresa tu correo', password: 'Ingresa una contraseña', confirm: 'Repite la contraseña' }[field];
    }
    if (control.hasError('email')) return 'Ingresa un correo válido';
    if (field === 'confirm' && this.form.hasError('mismatch')) return 'Las contraseñas no coinciden';
    return null;
  }

  protected clearServerError(field: Field): void {
    if (this.serverErrors()[field]) this.serverErrors.update((e) => ({ ...e, [field]: undefined }));
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.serverErrors.set({});
    const { username, email, password } = this.form.getRawValue();
    try {
      await this.auth.register({ username: username.trim(), email: email.trim(), password });
      this.done.set(true);
    } catch (e) {
      const fields = fieldErrors(e);
      if (Object.keys(fields).length) this.serverErrors.set(fields);
      else this.error.set(apiErrorMessage(e, 'No se pudo crear la cuenta'));
    } finally {
      this.loading.set(false);
    }
  }
}
