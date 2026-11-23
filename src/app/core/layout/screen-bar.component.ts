import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SweepIconComponent } from '@ui/primitives/sweep-icon/sweep-icon.component';
import { ScreenLink, isAdminScreen, parentScreen } from '../navigation/screens';
import { AppToolsComponent } from './app-tools.component';

/**
 * Top row of a screen, in place of a navigation bar: "back" to the screen it hangs from (see screens.ts), the
 * projected heading in the middle and the quick buttons (not in administration, a space apart from the game).
 * Every page has it through <eras-page>.
 */
@Component({
  selector: 'eras-screen-bar',
  imports: [RouterLink, SweepIconComponent, AppToolsComponent],
  template: `
    @if (parent(); as back) {
      <a class="back" erasSweep="chevron-left" wash [routerLink]="back.route" [queryParams]="back.queryParams ?? null" [state]="back.state" [attr.aria-label]="'Volver a ' + back.label"></a>
    }
    <div class="middle"><ng-content /></div>
    @if (!admin) {
      <eras-app-tools class="tools" />
    }
  `,
  styles: `
    // Top-aligned, as the hub screens' top row: "back" and the quick buttons start at the same line on every
    // screen, and a title that wraps to more lines grows downwards and moves nothing else
    :host {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
    }
    /* The arrow alone, big; gold sweeps over it and washes the row from the window's left edge (erasSweep wash) */
    .back {
      --sweep-size: 2.5rem;
      --sweep-wash-start: calc(var(--page-gutter-start, var(--layout-gutter)) - var(--space-2));
      margin-inline-start: calc(-1 * var(--space-2));
    }
    .back:hover,
    .back:focus-visible {
      transform: translateX(-3px);
    }
    .middle {
      display: flex;
      flex: 1;
      flex-wrap: wrap;
      // Taller page actions never push the title down: it keeps to the line of "back"
      align-items: flex-start;
      min-block-size: 2.5rem;
      gap: var(--space-3) var(--space-4);
      min-inline-size: 0;
    }
    .tools {
      flex-shrink: 0;
    }
    // Phones in landscape: one thin row ("back", title and page actions on a single line, centered)
    @media (orientation: landscape) and (max-height: 30rem) {
      :host {
        align-items: center;
        gap: var(--space-2);
      }
      .back {
        --sweep-size: 2rem;
      }
      .middle {
        flex-wrap: nowrap;
        align-items: center;
        min-block-size: 2rem;
        gap: var(--space-2) var(--space-3);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScreenBarComponent {
  /** Where "back" leads instead of the screen tree's parent (a screen reached from more than one place). */
  readonly back = input<ScreenLink>();

  // The page's own route (the bar lives inside it): a page is recreated for each screen, so reading it once is enough
  private readonly path =
    '/' +
    inject(ActivatedRoute)
      .snapshot.pathFromRoot.flatMap((r) => r.url.map((s) => s.path))
      .filter(Boolean)
      .join('/');
  private readonly routeParent = parentScreen(this.path);
  protected readonly admin = isAdminScreen(this.path);
  protected readonly parent = computed(() => this.back() ?? this.routeParent);
}
