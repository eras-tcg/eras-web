import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeTone = 'neutral' | 'success' | 'danger';

/** Small label. `color` overrides the tone with any CSS color or token (e.g. var(--color-rarity-sr)). */
@Component({
  selector: 'eras-badge',
  template: '<ng-content />',
  styleUrl: './badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"tone-" + tone()',
    '[style.--badge-color]': 'color()',
  },
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
  readonly color = input<string | null>(null);
}
