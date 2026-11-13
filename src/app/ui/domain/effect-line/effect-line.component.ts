import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One effect of a card, written out: chips for where it comes from (`source`, a Recurso or a link partner), its
 * moment ("Al Atacar") and its tags ("una vez por turno"), then its text.
 *
 * <eras-effect-line [moment]="line.moment" [tags]="line.tags" [text]="line.text" />
 */
@Component({
  selector: 'eras-effect-line',
  template: `
    @if (source() || moment() || tags().length) {
      <div class="chips">
        @if (source()) {
          <span class="chip source">{{ source() }}</span>
        }
        @if (moment()) {
          <span class="chip moment">{{ moment() }}</span>
        }
        @for (t of tags(); track $index) {
          <span class="chip tag">{{ t }}</span>
        }
      </div>
    }
    <p>{{ text() }}</p>
  `,
  styles: `
    :host { display: grid; gap: var(--space-1); }
    p { margin: 0; line-height: 1.5; }
    .chips { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .chip { padding: 0.05rem 0.55rem; border-radius: var(--radius-pill); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); }
    .chip.moment { background: color-mix(in srgb, var(--color-sim-moment) 22%, transparent); color: color-mix(in srgb, var(--color-sim-moment) 80%, var(--color-text)); }
    .chip.tag { background: color-mix(in srgb, var(--color-sim-effect) 20%, transparent); color: color-mix(in srgb, var(--color-sim-effect) 80%, var(--color-text)); }
    .chip.source { background: color-mix(in srgb, var(--color-card-g) 20%, transparent); color: color-mix(in srgb, var(--color-card-g) 80%, var(--color-text)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectLineComponent {
  readonly text = input.required<string>();
  readonly moment = input<string | null>(null);
  readonly tags = input<readonly string[]>([]);
  /** The card it comes from, when it is not the card's own effect. */
  readonly source = input<string | null>(null);
}
