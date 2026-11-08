import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@ui/primitives/icon/icon.component';

/**
 * The installed app held upright (where it could not be locked in landscape: iPhone, or a browser that refuses it):
 * "Gira el teléfono" over the whole app, as the table does in the browser. Shown by the styles only (a touch screen
 * in portrait), so it follows the phone at once; the App renders it only in the installed app.
 */
@Component({
  selector: 'eras-rotate-overlay',
  imports: [IconComponent],
  template: `
    <div class="rotate" role="alert">
      <eras-icon name="refresh" />
      <strong>Gira el teléfono</strong>
      <span>ERAS se juega en horizontal.</span>
    </div>
  `,
  styles: `
    .rotate {
      display: none;
    }
    @media (orientation: portrait) and (pointer: coarse) {
      .rotate {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: var(--space-2);
        padding: max(var(--space-6), env(safe-area-inset-top)) var(--space-6) max(var(--space-6), env(safe-area-inset-bottom));
        background: var(--color-bg, var(--color-surface));
        color: var(--color-text);
        text-align: center;
      }
      eras-icon {
        inline-size: 3rem;
        block-size: 3rem;
        color: var(--color-primary);
      }
      strong {
        font-size: var(--font-size-xl);
      }
      span {
        color: var(--color-text-muted);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotateOverlayComponent {}
