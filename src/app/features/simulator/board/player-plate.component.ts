import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';

/**
 * A player's plate on the table: their icon and name on a band that fades out, like a nameplate at the table's edge.
 * `flipped` (the rival's): turned over, the icon on the right and the slant on the left, so both plates face each other.
 */
@Component({
  selector: 'eras-player-plate',
  imports: [AvatarComponent],
  template: `
    <eras-avatar [url]="avatar()" [name]="username()" />
    <span class="name">{{ username() }}</span>
    @if (!connected()) {
      <span class="offline">desconectado</span>
    }
  `,
  styles: `
    /* The nameplate of the hub's player (hub-screen): the gold fading out to the right, its right edge cut on a slant,
       a thin line of gold along the bottom. Opaque: it overlaps the lives or the hand beside it, which must not show
       through (it would look under them) */
    :host {
      position: relative;
      display: flex;
      flex: none;
      align-items: center;
      gap: var(--space-2);
      min-inline-size: 0;
      padding: var(--space-1) var(--space-6) var(--space-1) var(--space-1);
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--color-hub-accent) 28%, var(--color-surface)),
        var(--color-surface) 70%
      );
      clip-path: polygon(0 0, 100% 0, calc(100% - 1rem) 100%, 0 100%);
    }
    :host::after {
      position: absolute;
      inset-inline: 0 1rem;
      inset-block-end: 0;
      block-size: 2px;
      background: linear-gradient(90deg, var(--color-hub-accent), transparent);
      content: '';
    }
    :host(.flipped) {
      flex-direction: row-reverse;
      padding: var(--space-1) var(--space-1) var(--space-1) var(--space-6);
      background: linear-gradient(
        270deg,
        color-mix(in srgb, var(--color-hub-accent) 28%, var(--color-surface)),
        var(--color-surface) 70%
      );
      clip-path: polygon(0 0, 100% 0, 100% 100%, 1rem 100%);
    }
    :host(.flipped)::after {
      inset-inline: 1rem 0;
      background: linear-gradient(270deg, var(--color-hub-accent), transparent);
    }
    :host(.flipped) .name { text-align: end; }
    :host(.away) { opacity: 0.75; }
    :host(.flipped.away)::after { background: linear-gradient(270deg, var(--color-danger), transparent); }
    :host(.away)::after { background: linear-gradient(90deg, var(--color-danger), transparent); }
    eras-avatar { --avatar-size: 2.25rem; }
    .name {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      font-family: var(--font-family-display);
      font-size: var(--font-size-md, 1rem);
      letter-spacing: 0.04em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .offline { flex: none; color: var(--color-danger); font-size: var(--font-size-xs); }
    /* Phones in landscape: small, it sat over the deck beside it in the narrow side column */
    @media (orientation: landscape) and (max-height: 30rem) {
      :host { gap: var(--space-1); padding: 2px var(--space-4) 2px 2px; }
      :host(.flipped) { padding: 2px 2px 2px var(--space-4); }
      eras-avatar { --avatar-size: 1.5rem; }
      .name { font-size: var(--font-size-xs); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.away]': '!connected()', '[class.flipped]': 'flipped()' },
})
export class PlayerPlateComponent {
  readonly username = input.required<string>();
  readonly avatar = input<string | null | undefined>(null);
  readonly connected = input(true, { transform: booleanAttribute });
  /** Turned over (the rival's), facing the other plate. */
  readonly flipped = input(false, { transform: booleanAttribute });
}
