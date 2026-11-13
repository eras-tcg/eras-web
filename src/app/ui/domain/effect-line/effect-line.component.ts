import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@ui/primitives/icon/icon.component';

/**
 * One effect of a card, written out: chips for where it comes from (`source`, a Recurso or a link partner), its
 * moment ("Al Atacar") and its tags ("una vez por turno"), then its text. `activeLabel` puts a first chip in the color of
 * the effect that is activating now ("Se activa"); the line's own highlight is the parent's.
 *
 * <eras-effect-line [moment]="line.moment" [tags]="line.tags" [text]="line.text" />
 */
@Component({
  selector: 'eras-effect-line',
  imports: [IconComponent],
  template: `
    @if (activeLabel() || source() || moment() || tags().length) {
      <div class="chips">
        @if (activeLabel()) {
          <span class="chip active"><eras-icon name="zap" /> {{ activeLabel() }}</span>
        }
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
    .chip { display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.05rem 0.55rem; border-radius: var(--radius-pill); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); }
    .chip.moment { background: color-mix(in srgb, var(--color-sim-moment) 22%, transparent); color: color-mix(in srgb, var(--color-sim-moment) 80%, var(--color-text)); }
    .chip.tag { background: color-mix(in srgb, var(--color-sim-effect) 20%, transparent); color: color-mix(in srgb, var(--color-sim-effect) 80%, var(--color-text)); }
    .chip.active { background: var(--color-sim-effect-active); color: var(--color-sim-on-effect-active); }
    .chip eras-icon { inline-size: 0.8rem; block-size: 0.8rem; }
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
  /** The effect is activating now: a first chip that says so. */
  readonly activeLabel = input<string | null>(null);
}
