import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Where you are inside a screen (a folder, a deckbox): the way back (a projected `[crumbs-back]` button, the page's
 * own, so it keeps its handlers), then the place you are in, in the display face, then anything else projected
 * (actions on the right, a hint on a line of its own with class `crumbs-hint`).
 *
 * <eras-crumbs>
 *   <button crumbs-back erasButton variant="glass" size="sm" type="button"><eras-icon name="chevron-left" /> Mazos</button>
 *   <ng-container crumbs-here>Aggro</ng-container>
 * </eras-crumbs>
 */
@Component({
  selector: 'eras-crumbs',
  template: `
    <nav class="trail" aria-label="Ubicación">
      <ng-content select="[crumbs-back]" />
      <span class="sep" aria-hidden="true">/</span>
      <span class="here" aria-current="page"><ng-content select="[crumbs-here]" /></span>
    </nav>
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-shrink: 0;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
    }
    .trail {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      min-inline-size: 0;
    }
    .sep {
      color: var(--color-text-subtle);
    }
    .here {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-family-display);
      font-size: var(--font-size-md);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrumbsComponent {}
