import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/**
 * Gem marker of a player: 5 pips; the owner changes it with − / +. A tray with the gems set in it: a lit one is a
 * cut green gem (facets and a shine), an empty one its socket cut in the tray; the − and + round at its ends.
 */
@Component({
  selector: 'eras-resource-pips',
  template: `
    @if (editable()) {
      <button type="button" class="step" aria-label="Quitar una gema del contador" [disabled]="value() <= 0" (click)="valueChange.emit(value() - 1)">−</button>
    }
    <span class="pips" role="img" [attr.aria-label]="'Contador de gemas: ' + value() + ' de ' + max()">
      @for (i of pips; track i) {
        <span class="pip" [class.on]="i <= value()"></span>
      }
    </span>
    @if (editable()) {
      <button type="button" class="step" aria-label="Sumar una gema al contador" [disabled]="value() >= max()" (click)="valueChange.emit(value() + 1)">+</button>
    }
  `,
  styles: `
    @use 'mixins/cut-corners';

    /* The tray */
    :host {
      --pip: 0.95rem;
      --btn: 1.5rem;
      display: inline-flex;
      align-items: center;
      // As wide as what it holds, centered where it lies (in a column or a grid cell wider than it)
      align-self: center;
      justify-self: center;
      inline-size: fit-content;
      gap: var(--space-1);
      padding: 0.2rem;
      border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
      border-radius: var(--radius-pill);
      background: linear-gradient(180deg, color-mix(in srgb, var(--color-surface-muted) 90%, #000), var(--color-surface-muted));
      box-shadow: inset 0 1px 3px rgb(0 0 0 / 35%), 0 1px 0 rgb(255 255 255 / 5%);
    }
    .pips {
      display: inline-flex;
      align-items: center;
      gap: calc(var(--pip) * 0.55);
      /* A turned gem is taller than its box (its diagonal): room above and below so it stays inside the tray */
      padding: calc(var(--pip) * 0.25) calc(var(--pip) * 0.45);
    }
    /* An empty gem: the same cut, dark and dull (four smoky facets, a faint bevel) */
    .pip {
      position: relative;
      inline-size: var(--pip);
      block-size: var(--pip);
      border-radius: 2px;
      background: conic-gradient(from 0deg at 50% 50%, #6b7280 0 25%, #4b5563 25% 50%, #1f2937 50% 75%, #374151 75% 100%);
      box-shadow: 0 0 0 1px rgb(0 0 0 / 45%), inset 0 0 0 1px rgb(255 255 255 / 10%), 0 1px 2px rgb(0 0 0 / 45%);
      opacity: 0.7;
      transform: rotate(45deg);
      transition: background var(--duration-fast, 120ms) ease, box-shadow var(--duration-fast, 120ms) ease;
    }
    /* A lit gem: four facets (light from the top left), a white edge and a green glow */
    .pip.on {
      opacity: 1;
      background:
        conic-gradient(from 0deg at 50% 50%, #86efac 0 25%, #22c55e 25% 50%, #15803d 50% 75%, #4ade80 75% 100%);
      box-shadow:
        0 0 0 1px rgb(255 255 255 / 55%),
        0 0 8px 2px rgb(34 197 94 / 55%);
    }
    /* Its shine */
    .pip.on::after {
      position: absolute;
      inset: 18% 46% 46% 18%;
      border-radius: 1px;
      background: rgb(255 255 255 / 75%);
      content: '';
    }
    .step {
      display: inline-grid;
      flex: none;
      place-items: center;
      inline-size: var(--btn);
      block-size: var(--btn);
      padding: 0;
      border: 1px solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: calc(var(--btn) * 0.6);
      font-weight: var(--font-weight-bold);
      line-height: 1;
      cursor: pointer;
      transition: border-color var(--duration-fast, 120ms) ease, color var(--duration-fast, 120ms) ease;
    }
    .step:hover:not(:disabled) { border-color: #22c55e; color: #22c55e; }
    .step:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .step:disabled { opacity: 0.35; cursor: default; }
    @media (prefers-reduced-motion: reduce) {
      .pip, .step { transition: none; }
    }
    /* Wide screens: a lower tray (the lives' zone under it starts nearer the Línea frontal's top) */
    @media not all and (orientation: landscape) and (max-height: 30rem) {
      :host { --pip: 0.8rem; --btn: 1.25rem; padding: 0.1rem; }
    }
    /* Phones in landscape: small enough (with − and +) for the table's narrow side column */
    @media (orientation: landscape) and (max-height: 30rem) {
      :host { --pip: 0.6rem; --btn: 1.05rem; gap: 2px; padding: 2px; }
      .pip.on { box-shadow: 0 0 0 1px rgb(255 255 255 / 55%), 0 0 5px 1px rgb(34 197 94 / 55%); }
    }
    /* "Estilo de la mesa: arcano" (the table sets --arcane-*): the tray and its − and + in the game's cut
       (mixins/cut-corners), the gems the ERAS gem (the site's icon): lit in gold, dull and dark when spent */
    :host-context(.arcane) {
      @include cut-corners.cut-corners(
        0.45rem,
        linear-gradient(180deg, color-mix(in srgb, var(--arcane-stone-dark) 85%, transparent), color-mix(in srgb, #1a1d23 75%, transparent)),
        var(--arcane-gold-soft)
      );

      box-shadow: none;
    }
    :host-context(.arcane) .pips { gap: calc(var(--pip) * 0.2); padding: calc(var(--pip) * 0.1) calc(var(--pip) * 0.25); }
    // Big enough to read at a glance: the gems are what the tray is about
    :host-context(.arcane) .pip {
      inline-size: calc(var(--pip) * 1.9);
      block-size: calc(var(--pip) * 1.9);
      border-radius: 0;
      background: url('/favicon.svg') center / contain no-repeat;
      box-shadow: none;
      opacity: 0.4;
      filter: grayscale(1) brightness(0.55);
      transform: none;
      transition: filter var(--duration-fast, 120ms) ease, opacity var(--duration-fast, 120ms) ease;
    }
    :host-context(.arcane) .pip.on {
      background: url('/favicon.svg') center / contain no-repeat;
      box-shadow: none;
      opacity: 1;
      filter: drop-shadow(0 0 4px rgb(56 189 248 / 70%)); /* the blue gem's own light */
    }
    :host-context(.arcane) .pip.on::after { display: none; }
    :host-context(.arcane) .step {
      --step-edge: var(--arcane-gold-soft);

      @include cut-corners.cut-corners(0.3rem, linear-gradient(180deg, #2a2620, #17140f), var(--step-edge));

      color: var(--arcane-gold-light);
    }
    :host-context(.arcane) .step:hover:not(:disabled) { --step-edge: var(--arcane-gold); color: var(--arcane-gold-light); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourcePipsComponent {
  readonly value = input(0);
  readonly max = input(5);
  readonly editable = input(false, { transform: booleanAttribute });
  readonly valueChange = output<number>();
  protected readonly pips = [1, 2, 3, 4, 5];
}
