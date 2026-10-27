import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** A card at its printed proportions (63×88). Optional corner `badge` text. */
@Component({
  selector: 'eras-card-image',
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="alt()" [attr.loading]="eager() ? null : 'lazy'" decoding="async" />
    } @else {
      <span class="missing">{{ alt() }}</span>
    }
    @if (badge()) {
      <span class="badge">{{ badge() }}</span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: grid;
      place-items: center;
      aspect-ratio: 63 / 88;
      overflow: hidden;
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
    }
    img { inline-size: 100%; block-size: 100%; object-fit: cover; }
    .missing { padding: var(--space-2); color: var(--color-text-subtle); font-size: var(--font-size-sm); text-align: center; }
    .badge {
      position: absolute;
      inset-inline: var(--space-1);
      inset-block-end: var(--space-1);
      padding: var(--space-1);
      border-radius: var(--radius-sm);
      background: var(--color-danger);
      color: #fff;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardImageComponent {
  readonly src = input<string | null>(null);
  readonly alt = input('');
  readonly badge = input<string | null>(null);
  readonly eager = input(false, { transform: booleanAttribute });
}
