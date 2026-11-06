import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { BoardAnimations } from './board-animations';

/**
 * A row of cards wider than its place (a crowded line of the field): it slides sideways, a card at a time, with the
 * arrows or the wheel. The cards keep their size; what is past the ends is hidden by the field. While an animation
 * plays the row stays where it is (a card flying to it must land where it was aimed).
 */
@Directive({
  selector: '[erasLineScroll]',
  exportAs: 'erasLineScroll',
  host: {
    '[style.transform]': 'transform()',
    '(wheel)': 'wheel($event)',
  },
})
export class LineScrollDirective {
  private readonly el: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly animations = inject(BoardAnimations, { optional: true });
  /** How much wider than its place the row is, in pixels (0: it fits). */
  private readonly overflow = signal(0);
  private readonly wanted = signal(0);
  /** How far the row has slid towards its end, in pixels. */
  readonly shift = computed(() => Math.max(0, Math.min(this.overflow(), this.wanted())));
  /** The row is wider than its place: the arrows show. */
  readonly scrolls = computed(() => this.overflow() > 1);
  /** An animation is playing: the row does not move. */
  readonly locked = computed(() => !(this.animations?.idle() ?? true));
  readonly canStart = computed(() => this.shift() > 1);
  readonly canEnd = computed(() => this.shift() < this.overflow() - 1);
  protected readonly transform = computed(() => (this.shift() ? `translateX(${-this.shift()}px)` : null));

  constructor() {
    const resize = new ResizeObserver(() => this.measure());
    const cards = new MutationObserver(() => {
      for (const child of Array.from(this.el.children)) resize.observe(child);
      this.measure();
    });
    resize.observe(this.el);
    cards.observe(this.el, { childList: true });
    afterNextRender(() => {
      for (const child of Array.from(this.el.children)) resize.observe(child);
      this.measure();
    });
    inject(DestroyRef).onDestroy(() => {
      resize.disconnect();
      cards.disconnect();
    });
  }

  /** Slides the row one card towards its start (-1) or its end (1). */
  by(direction: -1 | 1): void {
    if (this.locked()) return;
    this.wanted.set(Math.max(0, Math.min(this.overflow(), this.shift() + direction * this.step())));
  }

  protected wheel(event: WheelEvent): void {
    if (!this.scrolls()) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    this.by(delta > 0 ? 1 : -1);
  }

  /** One card and the gap after it. */
  private step(): number {
    const cards = Array.from(this.el.children) as HTMLElement[];
    if (cards.length < 2) return cards[0]?.offsetWidth ?? 0;
    return cards[1].offsetLeft - cards[0].offsetLeft;
  }

  // The row's cards from the first one's start to the last one's end (offsets ignore the slide), against its place
  private measure(): void {
    const cards = Array.from(this.el.children) as HTMLElement[];
    if (!cards.length) return this.overflow.set(0);
    const first = cards[0];
    const last = cards[cards.length - 1];
    const style = getComputedStyle(this.el);
    const room = this.el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const width = last.offsetLeft + last.offsetWidth - first.offsetLeft;
    this.overflow.set(Math.max(0, width - room));
  }
}
