import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { LoadingState } from '../http/loading';

/**
 * The loading screen of every screen but the simulator (LoadingState): the screen behind goes blurred, with a big
 * spinning gem and "Cargando…" under it. It catches the clicks meanwhile.
 */
@Component({
  selector: 'eras-loading-screen',
  imports: [IconComponent],
  template: `
    @if (loading.visible()) {
      <div class="veil" role="status" aria-live="polite">
        <div class="banner">
          <span class="gem" aria-hidden="true"><eras-icon name="gem" /></span>
          <span class="text">Cargando…</span>
        </div>
      </div>
    }
  `,
  styles: `
    .veil {
      position: fixed;
      inset: 0;
      z-index: var(--z-loading);
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--color-bg) 45%, transparent);
      backdrop-filter: blur(6px);
      animation: fade var(--duration-base, 200ms) ease both;
    }
    /* No box: the gem, big, and the word under it */
    .banner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      animation: rise 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .gem {
      display: grid;
      place-items: center;
      inline-size: 5rem;
      block-size: 5rem;
      color: var(--color-hub-accent);
      filter: drop-shadow(0 0 1.25rem color-mix(in srgb, var(--color-hub-accent) 60%, transparent));
      animation: spin 1.6s linear infinite;
    }
    .gem eras-icon {
      inline-size: 100%;
      block-size: 100%;
    }
    .text {
      font-family: var(--font-family-display);
      font-size: var(--font-size-lg);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-shadow: 0 2px 0.75rem var(--color-bg);
    }
    /* A gem turning on itself, as a coin */
    @keyframes spin {
      from {
        transform: perspective(12rem) rotateY(0deg);
      }
      to {
        transform: perspective(12rem) rotateY(360deg);
      }
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(0.5rem) scale(0.97);
      }
    }
    @keyframes pulse {
      50% {
        opacity: 0.45;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .gem {
        animation: pulse 1.6s ease-in-out infinite;
      }
      .banner {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingScreenComponent {
  protected readonly loading = inject(LoadingState);
}
