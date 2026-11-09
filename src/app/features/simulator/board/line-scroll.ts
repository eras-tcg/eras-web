import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { BoardAnimations } from './board-animations';

/** A sideways move past this many pixels slides the row (less is a tap). */
const DRAG_PX = 6;

/**
 * A row of cards wider than its place (a crowded line of the field): it slides sideways with the arrows, the wheel, or
 * dragging it with a finger or the mouse (as the hand turns). The cards keep their size; what is past the ends is hidden
 * by the field. While an animation plays the row stays where it is (a card flying to it must land where it was aimed).
 */
@Directive({
  selector: '[erasLineScroll]',
  exportAs: 'erasLineScroll',
  host: {
    '[style.transform]': 'transform()',
    '[class.dragging]': 'dragging()',
    '(wheel)': 'wheel($event)',
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up()',
    '(pointercancel)': 'up()',
    '(lostpointercapture)': 'lost($event)',
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
  /** Being dragged sideways (no slide animation: it follows the pointer). */
  protected readonly dragging = signal(false);

  /** A press on the row: where it began, the slide then, and the latest position (null: no press). */
  private press: { id: number; x0: number; y0: number; shift0: number; x: number; y: number } | null = null;
  /** The last press slid the row: its click is not a tap on a card. */
  private slid = false;

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
    // A slide is not a tap on the card under the pointer (captured before the card)
    const click = (e: Event) => {
      if (!this.slid) return;
      this.slid = false;
      e.stopPropagation();
      e.preventDefault();
    };
    // With the mouse a card of the field is dragged to attack; dragging it sideways slides the row instead (Chrome gives
    // dragstart the press's own position: measured from the last pointer move)
    const dragstart = (e: Event) => {
      const p = this.press;
      if (!p || !this.scrolls()) return;
      const dx = Math.abs(p.x - p.x0);
      if (dx < 4 || dx <= Math.abs(p.y - p.y0)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    this.el.addEventListener('click', click, true);
    this.el.addEventListener('dragstart', dragstart, true);
    inject(DestroyRef).onDestroy(() => {
      resize.disconnect();
      cards.disconnect();
      this.el.removeEventListener('click', click, true);
      this.el.removeEventListener('dragstart', dragstart, true);
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

  /** A finger, a pen or the mouse's main button on a crowded row: a sideways drag may slide it. */
  protected down(e: PointerEvent): void {
    if ((e.pointerType === 'mouse' && e.button !== 0) || !this.scrolls() || this.locked()) return;
    this.press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, shift0: this.shift(), x: e.clientX, y: e.clientY };
    this.slid = false;
  }

  /** Sideways (more than up or down): the row follows the pointer; the cards past an end come in. */
  protected move(e: PointerEvent): void {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    p.x = e.clientX;
    p.y = e.clientY;
    const dx = e.clientX - p.x0;
    if (!this.dragging()) {
      if (Math.abs(dx) < DRAG_PX || Math.abs(dx) <= Math.abs(e.clientY - p.y0) || this.locked()) return;
      this.dragging.set(true);
      this.el.setPointerCapture(e.pointerId);
    }
    this.slid = true;
    this.wanted.set(Math.max(0, Math.min(this.overflow(), p.shift0 - dx)));
  }

  /** The row lost the pointer (not a card under it handing it over to the row as it starts sliding). */
  protected lost(e: PointerEvent): void {
    if (e.target === this.el) this.up();
  }

  protected up(): void {
    this.press = null;
    this.dragging.set(false);
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
