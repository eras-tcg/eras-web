import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** A player's icon: the image they uploaded, or the initial of their name when they have none. */
@Component({
  selector: 'eras-avatar',
  template: `
    @if (url()) {
      <img [src]="url()" alt="" draggable="false" />
    } @else {
      <span class="initial">{{ initial() }}</span>
    }
  `,
  styles: `
    :host {
      --avatar-size: 2.5rem;
      display: inline-grid;
      flex: none;
      place-items: center;
      inline-size: var(--avatar-size);
      block-size: var(--avatar-size);
      overflow: hidden;
      border-radius: 50%;
      background: var(--color-primary);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 55%, #fff), 0 2px 8px rgb(0 0 0 / 35%);
      color: var(--color-on-primary);
    }
    img { inline-size: 100%; block-size: 100%; object-fit: cover; }
    .initial { font-size: calc(var(--avatar-size) * 0.42); font-weight: var(--font-weight-bold); line-height: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'label() || null',
  },
})
export class AvatarComponent {
  /** The icon's URL; null shows the initial of the name. */
  readonly url = input<string | null | undefined>(null);
  /** Whose icon it is: its initial when there is no image. */
  readonly name = input('');
  readonly label = input('');
  protected readonly initial = computed(() => (this.name() || '?').charAt(0).toUpperCase());
}
