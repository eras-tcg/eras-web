import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { ADMIN_TOOLS, AdminTool } from '@core/navigation/admin-tools';
import { legacyUrl } from '@core/navigation/legacy-url';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { CardComponent } from '@ui/surfaces/card/card.component';

/** Entry point to the administration tools the user is allowed to use. */
@Component({
  selector: 'eras-admin-page',
  imports: [RouterLink, PageComponent, GridComponent, CardComponent, StackComponent, EmptyStateComponent, IconComponent],
  template: `
    <eras-page title="Administración">
      @if (tools().length === 0) {
        <eras-empty-state title="No tienes herramientas de administración" />
      } @else {
        <eras-grid minColumn="16rem">
          @for (tool of tools(); track tool.label) {
            <eras-card interactive>
              <eras-stack [gap]="1">
                @if (tool.route) {
                  <a [routerLink]="tool.route"><strong>{{ tool.label }}</strong></a>
                } @else {
                  <a [href]="href(tool)"><strong>{{ tool.label }}</strong> <eras-icon name="external" /></a>
                }
                <span>{{ tool.description }}</span>
              </eras-stack>
            </eras-card>
          }
        </eras-grid>
      }
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPage {
  private readonly auth = inject(AuthService);
  protected readonly tools = computed(() => {
    this.auth.user();
    return ADMIN_TOOLS.filter((t) => t.permissions.some((p) => this.auth.can(p)));
  });
  protected href(tool: AdminTool): string {
    return legacyUrl(tool.legacyPath ?? '/');
  }
}
