import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CardImageComponent } from '@ui/domain/card-image/card-image.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { HubSlide } from './hub-rules';

const SLIDE_MS = 7000;

/**
 * Carousel of the home hub (featured edition, news), each slide a showcase: its text beside up to three
 * whole cards; the whole slide is its button (`selected`). Advances by itself every few seconds,
 * except while the pointer or the focus is on it, the tab is hidden or the user prefers reduced motion.
 */
@Component({
  selector: 'eras-hub-carousel',
  imports: [IconComponent, SpinnerComponent, CardImageComponent],
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

  /** A slide clicked (or Enter on it): the whole slide is the button (no button of its own; a news item's is in its pop-up). */
  readonly selected = output<HubSlide>();

  protected readonly index = signal(0);
  protected readonly paused = signal(false);
  protected readonly slide = computed(() => {
    const slides = this.slides();
    return slides.length ? slides[this.index() % slides.length] : null;
  });
  /** The slide shown, as a list of one: each slide its own element, so changing slides fades one out and the next in. */
  protected readonly shown = computed(() => {
    const slide = this.slide();
    return slide ? [slide] : [];
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
