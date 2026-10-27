import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';

type Status = { state: 'loading' } | { state: 'success' } | { state: 'error'; message: string };

/** Target of the link in the verification e-mail: /validate?token=… */
@Component({
  selector: 'eras-validate-page',
  imports: [RouterLink, PageComponent, CardComponent, EmptyStateComponent, SpinnerComponent, ButtonComponent],
  template: `
    <eras-page title="Validar cuenta" width="narrow">
      <eras-card padding="lg">
        @switch (status().state) {
          @case ('loading') {
            <eras-empty-state title="Verificando tu cuenta…"><eras-spinner /></eras-empty-state>
          }
          @case ('success') {
            <eras-empty-state title="¡Cuenta verificada!" description="Tu correo quedó confirmado. Ya puedes iniciar sesión.">
              <a erasButton routerLink="/login">Iniciar sesión</a>
            </eras-empty-state>
          }
          @case ('error') {
            <eras-empty-state title="No se pudo verificar" [description]="errorMessage()">
              <a erasButton variant="secondary" routerLink="/register">Volver al registro</a>
            </eras-empty-state>
          }
        }
      </eras-card>
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidatePage {
  /** `?token=` (bound by the router). */
  readonly token = input<string>();

  private readonly auth = inject(AuthService);
  protected readonly status = signal<Status>({ state: 'loading' });

  constructor() {
    effect(() => {
      const token = this.token();
      untracked(() => void this.verify(token));
    });
  }

  protected errorMessage(): string {
    const s = this.status();
    return s.state === 'error' ? s.message : '';
  }

  private async verify(token: string | undefined): Promise<void> {
    if (!token) {
      this.status.set({ state: 'error', message: 'El enlace no trae un código de verificación.' });
      return;
    }
    this.status.set({ state: 'loading' });
    try {
      await this.auth.verify(token);
      this.status.set({ state: 'success' });
    } catch (e) {
      this.status.set({ state: 'error', message: apiErrorMessage(e, 'El enlace es inválido o expiró.') });
    }
  }
}
