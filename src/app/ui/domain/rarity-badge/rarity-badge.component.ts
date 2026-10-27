import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BadgeComponent } from '../../primitives/badge/badge.component';

export type Rarity = 'C' | 'UC' | 'R' | 'SR' | 'SEC';

/** Badge in the color of a card rarity; optional count (e.g. "3× UC"). */
@Component({
  selector: 'eras-rarity-badge',
  imports: [BadgeComponent],
  template: `<eras-badge [color]="color()">{{ label() }}</eras-badge>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RarityBadgeComponent {
  readonly rarity = input.required<Rarity>();
  readonly count = input<number | null>(null);

  protected readonly color = computed(() => `var(--color-rarity-${this.rarity().toLowerCase()})`);
  protected readonly label = computed(() => {
    const count = this.count();
    return count === null ? this.rarity() : `${count}× ${this.rarity()}`;
  });
}
