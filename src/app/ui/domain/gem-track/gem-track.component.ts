import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface GemTrackSlot {
  value: number;
  side: 'player' | 'rival' | 'center';
  state: 'available' | 'spent' | 'excess' | 'zero' | 'empty';
}

const STATE_LABELS: Record<GemTrackSlot['state'], string> = {
  available: 'disponible',
  spent: 'gastada',
  excess: 'tomada del rival',
  zero: 'centro',
  empty: '',
};

/** Row of numbered gem slots; each state has its own color and a text legend below. */
@Component({
  selector: 'eras-gem-track',
  template: `
    <ol class="track" [attr.aria-label]="label()">
      @for (slot of slots(); track $index) {
        <li [class]="slot.state" [attr.aria-label]="slot.value + (stateLabel(slot) ? ', ' + stateLabel(slot) : '')">{{ slot.value }}</li>
      }
    </ol>
    @if (legend()) {
      <ul class="legend">
        <li><span class="dot available"></span> Disponible</li>
        <li><span class="dot spent"></span> Gastada</li>
        <li><span class="dot excess"></span> Tomada del rival</li>
      </ul>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    .track { display: grid; grid-template-columns: repeat(21, minmax(0, 1fr)); gap: 2px; margin: 0; padding: 0; list-style: none; }
    .track li {
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      border: var(--border-width) solid var(--color-border);
      border-radius: 50%;
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-variant-numeric: tabular-nums;
    }
    .track li.zero { border-width: 2px; color: var(--color-text); font-weight: var(--font-weight-bold); }
    .available { background: var(--color-success); }
    .spent { background: var(--color-card-b); }
    .excess { background: var(--color-danger); }
    .track li.available, .track li.spent, .track li.excess { border-color: transparent; color: #fff; font-weight: var(--font-weight-bold); }
    .legend { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: 0; padding: 0; list-style: none; color: var(--color-text-muted); font-size: var(--font-size-xs); }
    .legend li { display: inline-flex; align-items: center; gap: var(--space-1); }
    .dot { inline-size: 0.75rem; block-size: 0.75rem; border-radius: 50%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GemTrackComponent {
  readonly slots = input.required<GemTrackSlot[]>();
  readonly label = input('Pista de gemas');
  readonly legend = input(true);

  protected stateLabel(slot: GemTrackSlot): string {
    return STATE_LABELS[slot.state];
  }
}
