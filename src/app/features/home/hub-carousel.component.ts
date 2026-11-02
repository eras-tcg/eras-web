import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { Deck } from '@data/decks/deck.model';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { HubSlide } from './hub-rules';

const SLIDE_MS = 7000;

/**
 * Carousel of the home hub (featured edition, featured decks, news). Advances by itself every few seconds,
 * except while the pointer or the focus is on it, the tab is hidden or the user prefers reduced motion.
 */
@Component({
  selector: 'eras-hub-carousel',
  imports: [IconComponent, SpinnerComponent],
  templateUrl: './hub-carousel.component.html',
  styleUrl: './hub-carousel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    'aria-roledescription': 'carrusel',
    'aria-label': 'Destacados y noticias',
    '(mouseenter)': 'paused.set(true)',
    '(mouseleave)': 'paused.set(false)',
    '(focusin)': 'paused.set(true)',
    '(focusout)': 'paused.set(false)',
  },
})
export class HubCarouselComponent {
  readonly slides = input.required<HubSlide[]>();
  readonly loading = input(false);

  readonly editionSelected = output<string>();
  readonly deckSelected = output<Deck>();

  protected readonly index = signal(0);
  protected readonly paused = signal(false);
  protected readonly slide = computed(() => {
    const slides = this.slides();
    return slides.length ? slides[this.index() % slides.length] : null;
  });

  constructor() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      if (!this.paused() && !document.hidden) this.move(1);
    }, SLIDE_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected move(delta: number): void {
    const count = this.slides().length;
    if (count > 0) this.index.update((i) => ((((i % count) + delta) % count) + count) % count);
  }
}
