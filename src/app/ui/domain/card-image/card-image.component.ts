import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** A card at its printed proportions (63×88). Optional small `badge` at the top (it leaves the printed name visible). */
@Component({
  selector: 'eras-card-image',
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="alt()" [attr.loading]="eager() ? null : 'lazy'" decoding="async" />
    } @else {
      <span class="missing">{{ alt() }}</span>
    }
    @if (badge()) {
      <span class="badge" [class.info]="badgeTone() === 'info'">{{ badge() }}</span>
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
      inset-block-start: 12%;
      inset-inline-start: 50%;
      max-inline-size: 90%;
      padding: 0.1rem 0.4rem;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-danger) 75%, transparent);
      color: #fff;
      font-size: 0.625rem;
      font-weight: var(--font-weight-bold);
      line-height: 1.4;
      white-space: nowrap;
      text-overflow: ellipsis;
      transform: translateX(-50%);
      pointer-events: none;
    }
    .badge.info { background: color-mix(in srgb, var(--color-info) 75%, transparent); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardImageComponent {
  readonly src = input<string | null>(null);
  readonly alt = input('');
  readonly badge = input<string | null>(null);
  /** danger (red: missing data) or info (blue). */
  readonly badgeTone = input<'danger' | 'info'>('danger');
  readonly eager = input(false, { transform: booleanAttribute });
}
