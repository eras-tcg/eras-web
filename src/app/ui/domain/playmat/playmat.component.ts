import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface PlaymatZone {
  /** Number shown on the mat and in the explanation. */
  number: number;
  name: string;
  /** Grid area on the mat. */
  area: 'gems' | 'lives' | 'front' | 'back' | 'deck' | 'tributes' | 'discard';
}

/** Schematic play mat of one player, with numbered zones (the explanation is rendered by the page). */
@Component({
  selector: 'eras-playmat',
  template: `
    <div class="mat" role="img" [attr.aria-label]="'Tablero: ' + summary()">
      @for (zone of zones(); track zone.area) {
        <div class="zone" [style.grid-area]="zone.area">
          <span class="number">{{ zone.number }}</span>
          <span class="name">{{ zone.name }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .mat {
      display: grid;
      grid-template-columns: 1fr 3fr 1fr;
      grid-template-rows: auto repeat(2, minmax(5rem, auto));
      grid-template-areas:
        'gems gems gems'
        'lives front deck'
        'tributes back discard';
      gap: var(--space-2);
      padding: var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface-muted);
    }
    .zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      padding: var(--space-2);
      border: 2px dashed var(--color-border);
      border-radius: var(--radius-md);
      text-align: center;
    }
    .number {
      display: grid;
      place-items: center;
      inline-size: 1.75rem;
      block-size: 1.75rem;
      border-radius: 50%;
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-weight: var(--font-weight-bold);
    }
    .name { font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); letter-spacing: 0.06em; text-transform: uppercase; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaymatComponent {
  readonly zones = input.required<PlaymatZone[]>();
  protected summary(): string {
    return this.zones()
      .map((z) => `${z.number} ${z.name}`)
      .join(', ');
  }
}
