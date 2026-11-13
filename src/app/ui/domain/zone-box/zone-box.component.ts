import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';

/**
 * Cards of a choice boxed by the zone they come from (or one formation of the Línea frontal), the zone's name over
 * them (standing at the box's side on phones in landscape). `bare`: no box, only its room (a loose creature); `lit`:
 * the box something dragged would join.
 *
 * <eras-zone-box label="Mano" icon="zone-hand">…cards…</eras-zone-box>
 */
@Component({
  selector: 'eras-zone-box',
  imports: [IconComponent],
  template: `
    @if (label()) {
      <span class="zone-name">
        @if (icon(); as name) {
          <eras-icon [name]="name" />
        }
        {{ label() }}
      </span>
    }
    <div class="zone-cards"><ng-content /></div>
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex: none;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2) var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--color-surface-muted) 60%, transparent);
    }
    :host(.bare) { border-color: transparent; background: none; }
    :host(.lit) { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 14%, transparent); }
    :host(.lit.bare) { border-style: dashed; }
    .zone-name {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--color-text-muted);
      font-size: 0.65rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .zone-name eras-icon { inline-size: 0.85rem; block-size: 0.85rem; }
    .zone-cards { display: flex; gap: var(--space-2); }
    // Phones in landscape: the zone's name stands up at the box's side, no line of its own over the cards
    @media (orientation: landscape) and (max-height: 30rem) {
      :host { flex-direction: row; padding: var(--space-1); }
      .zone-name { font-size: 0.6rem; writing-mode: vertical-rl; transform: rotate(180deg); }
      // The name reads upwards; its icon stays upright
      .zone-name eras-icon { transform: rotate(180deg); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.bare]': 'bare()', '[class.lit]': 'lit()', role: 'group', '[attr.aria-label]': 'label()' },
})
export class ZoneBoxComponent {
  readonly label = input<string | null>(null);
  readonly icon = input<IconName | null>(null);
  readonly bare = input(false, { transform: booleanAttribute });
  readonly lit = input(false, { transform: booleanAttribute });
}
