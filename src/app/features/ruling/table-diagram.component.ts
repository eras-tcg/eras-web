import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type TableZone = 'lives' | 'hand' | 'deck' | 'back' | 'front' | 'tributes' | 'discard' | 'marker' | 'counter';

/** The zones as the table shows them, numbered as the page explains them. */
export const TABLE_ZONES: { zone: TableZone; number: number; name: string }[] = [
  { zone: 'front', number: 1, name: 'Línea frontal' },
  { zone: 'back', number: 2, name: 'Retaguardia' },
  { zone: 'lives', number: 3, name: 'Vidas' },
  { zone: 'hand', number: 4, name: 'Mano' },
  { zone: 'deck', number: 5, name: 'Mazo' },
  { zone: 'tributes', number: 6, name: 'Tributos' },
  { zone: 'discard', number: 7, name: 'Descarte' },
  { zone: 'marker', number: 8, name: 'Marcador' },
  { zone: 'counter', number: 9, name: 'Contador de gemas' },
];

/**
 * Schematic table (rules v1.1, section 4): the rival's half on top, mirrored, the shared gem Contador between both
 * halves, and your half with its numbered zones. The Línea frontal faces the rival; creatures arrive in the
 * Retaguardia. `active` lights a zone; hovering or clicking one emits it.
 */
@Component({
  selector: 'eras-table-diagram',
  template: `
    <div class="table" role="img" aria-label="Mesa de juego: la mitad del rival arriba, el Contador de gemas al centro y tu mitad abajo con sus zonas numeradas">
      <div class="half rival" aria-hidden="true">
        <span class="z piles">Mazo y pilas</span>
        <span class="z back">Retaguardia</span>
        <span class="z lives">Vidas</span>
        <span class="z front">Línea frontal del rival</span>
      </div>
      <button type="button" class="counter" [class.on]="active() === 'counter'" (mouseenter)="picked.emit('counter')" (focus)="picked.emit('counter')" (click)="picked.emit('counter')">
        <span class="n">9</span>
        <span class="line">10 · · · 1 <b>0</b> 1 · · · 10</span>
      </button>
      <div class="half you">
        @for (z of zones; track z.zone) {
          @if (z.zone !== 'counter') {
            <button type="button" [class]="'z ' + z.zone" [class.on]="active() === z.zone" (mouseenter)="picked.emit(z.zone)" (focus)="picked.emit(z.zone)" (click)="picked.emit(z.zone)">
              <span class="n">{{ z.number }}</span> {{ z.name }}
            </button>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .table {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
      background: radial-gradient(ellipse at center, color-mix(in srgb, var(--color-hub-accent) 10%, var(--color-surface-muted)), var(--color-surface-muted));
    }
    .half { display: grid; grid-template-columns: 1fr 2.4fr 1fr; gap: var(--space-2); }
    .rival { grid-template-areas: 'piles back lives' '. front .'; opacity: 0.45; }
    .you {
      grid-template-columns: 1fr 2.4fr 1fr;
      grid-template-areas:
        'marker front .'
        'lives back deck'
        'lives back tributes'
        'hand hand discard';
    }
    .z {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      min-block-size: 2.75rem;
      min-inline-size: 0;
      padding: var(--space-1) var(--space-2);
      hyphens: auto;
      border: 2px dashed color-mix(in srgb, var(--color-text) 28%, transparent);
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--color-surface) 75%, transparent);
      color: var(--color-text);
      font: inherit;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.04em;
      text-align: center;
      text-transform: uppercase;
      transition: border-color 150ms ease, background 150ms ease;
    }
    button.z { cursor: pointer; }
    .front { grid-area: front; min-block-size: 3.5rem; }
    .back { grid-area: back; }
    .lives { grid-area: lives; }
    .hand { grid-area: hand; }
    .deck { grid-area: deck; }
    .tributes { grid-area: tributes; }
    .discard { grid-area: discard; }
    .marker { grid-area: marker; }
    .piles { grid-area: piles; }
    .z.on, .counter.on { border-style: solid; border-color: var(--color-hub-accent); background: color-mix(in srgb, var(--color-hub-accent) 18%, transparent); }
    .counter {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-1);
      border: 2px dashed color-mix(in srgb, var(--color-hub-accent) 60%, transparent);
      border-radius: var(--radius-pill);
      background: none;
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
      font-size: var(--font-size-xs);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.08em;
    }
    @media (max-width: 30rem) {
      .table { padding: var(--space-2); gap: var(--space-1); }
      .half { gap: var(--space-1); }
      .z { flex-direction: column; padding: var(--space-1); font-size: 0.56rem; letter-spacing: 0; }
    }
    .n {
      display: inline-grid;
      flex-shrink: 0;
      place-items: center;
      inline-size: 1.4rem;
      block-size: 1.4rem;
      border-radius: 50%;
      background: var(--color-primary);
      color: var(--color-on-primary);
      letter-spacing: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableDiagramComponent {
  readonly active = input<TableZone | null>(null);
  readonly picked = output<TableZone>();
  protected readonly zones = TABLE_ZONES;
}
