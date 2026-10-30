import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { parseAvatar } from './avatar';
import { IconComponent } from '@ui/primitives/icon/icon.component';

/** A player's icon: their emblem on the ground of a color identity, framed like a gem. */
@Component({
  selector: 'eras-avatar',
  imports: [IconComponent],
  template: `<eras-icon [name]="parsed().icon" />`,
  styles: `
    :host {
      --avatar-size: 2.5rem;
      display: inline-grid;
      flex: none;
      place-items: center;
      inline-size: var(--avatar-size);
      block-size: var(--avatar-size);
      border-radius: 50%;
      /* Fixed identity colors, the same in both themes, like the cards' frames */
      background: radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--avatar-ground) 55%, #fff), var(--avatar-ground) 70%);
      box-shadow: 0 0 0 2px var(--avatar-ring), 0 2px 8px rgb(0 0 0 / 35%);
      color: var(--avatar-ink);
    }
    :host([data-color='B']) { --avatar-ground: #1d4ed8; --avatar-ring: #93c5fd; --avatar-ink: #eff6ff; }
    :host([data-color='G']) { --avatar-ground: #15803d; --avatar-ring: #86efac; --avatar-ink: #f0fdf4; }
    :host([data-color='P']) { --avatar-ground: #6d28d9; --avatar-ring: #c4b5fd; --avatar-ink: #f5f3ff; }
    :host([data-color='R']) { --avatar-ground: #b91c1c; --avatar-ring: #fca5a5; --avatar-ink: #fef2f2; }
    :host([data-color='W']) { --avatar-ground: #e7e5e4; --avatar-ring: #a8a29e; --avatar-ink: #292524; }
    eras-icon { inline-size: 55%; block-size: 55%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-color]': 'parsed().color',
    role: 'img',
    '[attr.aria-label]': 'label() || null',
  },
})
export class AvatarComponent {
  /** "icon:color" as the profile stores it; null or unknown shows the default icon. */
  readonly avatar = input<string | null | undefined>(null);
  readonly label = input('');
  protected readonly parsed = computed(() => parseAvatar(this.avatar()));
}
