import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CoverFrame } from '@data/editions/edition.model';
import { coverFrameStyle } from '@data/editions/edition-rules';

/**
 * An edition as a card-shaped tile, as in the shop: its cover behind (placed by its framing), its code, name and
 * an optional line at the bottom over a scrim. `foil` makes the cover shine as a foil or prism card does; `dimmed`
 * puts it in grey; `inDevelopment` marks an edition an admin hid (in development).
 */
@Component({
  selector: 'eras-edition-tile',
  host: { '[class.dimmed]': 'dimmed()' },
  template: `
    @if (image()) {
      <img
        [src]="image()"
        alt=""
        loading="lazy"
        [style.object-position]="place().position"
        [style.transform-origin]="place().position"
        [style.transform]="place().transform"
      />
    }
    @if (foil()) {
      <span class="shine" [class.prism]="foil() === 'prism'"></span>
    }
    @if (inDevelopment()) {
      <span class="hidden-mark">En desarrollo</span>
    }
    <span class="info">
      <span class="code">{{ code() }}</span>
      <span class="title">{{ name() || code() }}</span>
      @if (detail()) {
        <span class="detail">{{ detail() }}</span>
      }
    </span>
  `,
  styles: `
    @use 'mixins/foil';

    :host {
      position: relative;
      display: flex;
      align-items: flex-end;
      aspect-ratio: 744 / 1039;
      overflow: hidden;
      border: 2px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface-muted);
      box-shadow: var(--shadow-sm);
      color: var(--color-hub-text);
    }
    img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    :host(.dimmed) img {
      filter: grayscale(1);
    }
    /* The shine over the cover, under the scrim and the text (its own layer: the foil blends with the cover) */
    .shine {
      position: absolute;
      inset: 0;
      mix-blend-mode: soft-light;
      pointer-events: none;
    }
    .shine::after {
      @include foil.rainbow($blend: normal);
    }
    .shine.prism {
      mix-blend-mode: normal;
      @include foil.scaled;
    }
    .shine.prism::before {
      @include foil.glitter-dots;
    }
    .shine.prism::after {
      @include foil.glitter-light;
    }
    :host::after {
      position: absolute;
      inset: 0;
      background: linear-gradient(0deg, color-mix(in srgb, var(--color-hub-scrim) 92%, transparent) 0%, transparent 55%);
      content: '';
    }
    .info {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      inline-size: 100%;
      padding: var(--space-3);
    }
    .code {
      color: var(--color-hub-accent);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.08em;
    }
    .title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-md);
      line-height: 1.15;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      hyphens: auto;
      overflow-wrap: break-word;
    }
    .hidden-mark {
      position: absolute;
      inset-block-start: var(--space-2);
      inset-inline-start: var(--space-2);
      z-index: 1;
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--color-hub-scrim) 85%, transparent);
      color: var(--color-hub-accent);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.04em;
    }
    .detail {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionTileComponent {
  readonly image = input<string | null | undefined>(null);
  readonly frame = input<CoverFrame | null | undefined>(null);
  readonly code = input.required<string>();
  readonly name = input<string | null | undefined>(null);
  readonly detail = input<string | null>(null);
  readonly foil = input<'foil' | 'prism' | null>(null);
  readonly dimmed = input(false);
  readonly inDevelopment = input(false);

  protected readonly place = computed(() => coverFrameStyle(this.frame()));
}
