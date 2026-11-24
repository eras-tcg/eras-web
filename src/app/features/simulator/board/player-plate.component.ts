import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';

/**
 * A player's plate on the table: their icon, big and ringed in gold, and their name on a tag that comes out from behind
 * it (the hub nameplate's gold fading out, a slanted tip, a line of gold along its foot). `flipped` (the rival's):
 * turned over, the tag coming out to the left, so both plates face each other.
 */
@Component({
  selector: 'eras-player-plate',
  imports: [AvatarComponent],
  template: `
    <eras-avatar class="icon" [url]="avatar()" [name]="username()" />
    <span class="tag">
      <span class="name">{{ username() }}</span>
      @if (!connected()) {
        <span class="offline">desconectado</span>
      }
    </span>
  `,
  styles: `
    :host {
      --plate-icon: 2.75rem;

      display: flex;
      flex: none;
      align-items: center;
      min-inline-size: 0;
    }
    :host(.flipped) { flex-direction: row-reverse; }
    // Over the tag, in a double ring of gold (a thick one, a dark gap, a thin one): the tag's straight end hides behind it
    .icon {
      --avatar-size: var(--plate-icon);

      position: relative;
      z-index: 1;
      flex: none;
      box-shadow:
        0 0 0 2px var(--color-hub-accent),
        0 0 0 4px #17140f,
        0 0 0 5px var(--color-frame-gold-pale),
        0 0 10px 5px color-mix(in srgb, var(--color-hub-accent) 25%, transparent),
        0 4px 12px rgb(0 0 0 / 45%);
    }
    // The tag: from under the icon's middle, gold fading out, its far end cut on a slant, a line of gold along its foot.
    // Opaque: it overlaps the lives or the hand beside it, which must not show through (it would look under them)
    .tag {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-inline-size: 0;
      margin-inline-start: calc(var(--plate-icon) / -2);
      padding: var(--space-1) var(--space-5) var(--space-1) calc(var(--plate-icon) / 2 + var(--space-2));
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--color-hub-accent) 30%, var(--color-surface)),
        var(--color-surface) 75%
      );
      clip-path: polygon(0 0, 100% 0, calc(100% - 1rem) 100%, 0 100%);
    }
    .tag::after {
      position: absolute;
      inset-inline: 0 1rem;
      inset-block-end: 0;
      block-size: 2px;
      background: linear-gradient(90deg, var(--color-hub-accent), transparent);
      content: '';
    }
    :host(.flipped) .tag {
      margin-inline: 0 calc(var(--plate-icon) / -2);
      padding: var(--space-1) calc(var(--plate-icon) / 2 + var(--space-2)) var(--space-1) var(--space-5);
      background: linear-gradient(
        270deg,
        color-mix(in srgb, var(--color-hub-accent) 30%, var(--color-surface)),
        var(--color-surface) 75%
      );
      clip-path: polygon(0 0, 100% 0, 100% 100%, 1rem 100%);
    }
    :host(.flipped) .tag::after {
      inset-inline: 1rem 0;
      background: linear-gradient(270deg, var(--color-hub-accent), transparent);
    }
    :host(.flipped) .name { text-align: end; }
    :host(.away) { opacity: 0.75; }
    :host(.away) .icon { box-shadow: 0 0 0 2px var(--color-danger), 0 0 0 4px #17140f, 0 0 0 5px var(--color-danger), 0 4px 12px rgb(0 0 0 / 45%); }
    :host(.away) .tag::after { background: linear-gradient(90deg, var(--color-danger), transparent); }
    :host(.flipped.away) .tag::after { background: linear-gradient(270deg, var(--color-danger), transparent); }
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
      :host { --plate-icon: 1.9rem; }
      .tag { gap: var(--space-1); padding-block: 1px; padding-inline-end: var(--space-4); }
      :host(.flipped) .tag { padding-inline: var(--space-4) calc(var(--plate-icon) / 2 + var(--space-1)); }
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
