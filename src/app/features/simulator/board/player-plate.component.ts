import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';

/** A player's plate on the table: their icon and name on a band that fades out, like a nameplate at the table's edge. */
@Component({
  selector: 'eras-player-plate',
  imports: [AvatarComponent],
  template: `
    <eras-avatar [avatar]="avatar()" />
    <span class="name">{{ username() }}</span>
    @if (!connected()) {
      <span class="offline">desconectado</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex: none;
      align-items: center;
      gap: var(--space-2);
      min-inline-size: 0;
      padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
      border: 1px solid color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
      border-radius: var(--radius-pill);
      background: linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 22%, var(--color-surface)) 0%,
        color-mix(in srgb, var(--color-surface) 92%, transparent) 75%);
      box-shadow: 0 2px 10px rgb(0 0 0 / 25%);
    }
    :host(.away) { border-color: var(--color-danger); opacity: 0.75; }
    eras-avatar { --avatar-size: 2.25rem; }
    .name {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      font-size: var(--font-size-md, 1rem);
      font-weight: var(--font-weight-bold);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .offline { flex: none; color: var(--color-danger); font-size: var(--font-size-xs); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.away]': '!connected()' },
})
export class PlayerPlateComponent {
  readonly username = input.required<string>();
  readonly avatar = input<string | null | undefined>(null);
  readonly connected = input(true, { transform: booleanAttribute });
}
