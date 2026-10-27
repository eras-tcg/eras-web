import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';

@Component({
  selector: 'eras-not-found-page',
  imports: [PageComponent, EmptyStateComponent, ButtonComponent, RouterLink],
  template: `
    <eras-page title="Página no encontrada" width="narrow">
      <eras-empty-state title="Esta página no existe" description="Puede que todavía no se haya migrado a la nueva versión.">
        <a erasButton routerLink="/">Volver al inicio</a>
      </eras-empty-state>
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
