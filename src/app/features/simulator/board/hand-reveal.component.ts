import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';

/** A card revealed from a hand: it turns over, big, at the middle of the screen for a moment (the rival sees what it is). */
@Component({
  selector: 'eras-hand-reveal',
  template: `
    @for (card of game.revealed(); track card.id) {
      <figure class="revealed" role="status" aria-live="polite">
        <span class="flip">
          <span class="back" aria-hidden="true"></span>
          @if (card.imageUrl) {
            <img [src]="card.imageUrl" [alt]="card.name ?? 'Carta revelada'" />
          }
        </span>
        <figcaption>Revela {{ card.name ?? 'una carta' }}</figcaption>
      </figure>
    }
  `,
  styles: `
    .revealed {
      position: fixed;
      inset-block-start: 50%;
      inset-inline-start: 50%;
      z-index: var(--z-sim-hand-reveal);
      display: grid;
      justify-items: center;
      gap: var(--space-2);
      margin: 0;
      pointer-events: none;
      transform: translate(-50%, -50%);
      animation: revealed var(--sim-hand-reveal, 3s) ease forwards;
    }
    .flip {
      position: relative;
      display: block;
      inline-size: min(14rem, 40vw);
      aspect-ratio: 63 / 88;
      transform-style: preserve-3d;
      animation: turn 0.7s cubic-bezier(0.3, 0.8, 0.3, 1) 0.15s backwards;
    }
    .flip img, .back {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      border-radius: var(--radius-md);
      object-fit: cover;
      backface-visibility: hidden;
      box-shadow: 0 0 0 2px var(--color-sim-glow), 0 0 36px 8px color-mix(in srgb, var(--color-sim-glow) 45%, transparent);
    }
    .back { background: var(--color-card-back); transform: rotateY(180deg); }
    figcaption {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 70%);
      color: #fff;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
    }
    @keyframes turn { from { transform: rotateY(180deg) scale(0.6); } }
    @keyframes revealed { 0% { opacity: 0; } 8% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .revealed, .flip { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandRevealComponent {
  protected readonly game = inject(GameStore);
}
