import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ADMIN_GROUPS, ADMIN_TOOLS } from '@core/navigation/admin-tools';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { LinkTileComponent } from '@ui/surfaces/link-tile/link-tile.component';

/** Entry point to the administration tools the user is allowed to use, grouped by area. */
@Component({
  selector: 'eras-admin-page',
  imports: [PageComponent, GridComponent, StackComponent, SectionHeaderComponent, EmptyStateComponent, LinkTileComponent],
  template: `
    <eras-page title="Administración" subtitle="Herramientas para gestionar cuentas, cartas y partidas">
      @if (groups().length === 0) {
        <eras-empty-state title="No tienes herramientas de administración" />
      } @else {
        <eras-stack [gap]="6">
          @for (group of groups(); track group.name) {
            <section>
              <eras-stack [gap]="3">
                <eras-section-header [title]="group.name" />
                <eras-grid minColumn="18rem" [gap]="3">
                  @for (tool of group.tools; track tool.route) {
                    <eras-link-tile [link]="tool.route" [icon]="tool.icon" [heading]="tool.label" [description]="tool.description" />
                  }
                </eras-grid>
              </eras-stack>
            </section>
          }
        </eras-stack>
      }
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPage {
  private readonly auth = inject(AuthService);

  protected readonly groups = computed(() => {
    this.auth.user();
    const allowed = ADMIN_TOOLS.filter((t) => t.permissions.some((p) => this.auth.can(p)));
    return ADMIN_GROUPS.map((name) => ({ name, tools: allowed.filter((t) => t.group === name) })).filter((g) => g.tools.length);
  });
}
