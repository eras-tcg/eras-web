import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { fitItemWidth } from './fit-grid';

/**
 * Sizes card-shaped items so that all of them fit in the element without scrolling: it measures the element's room
 * (without padding) and sets `--fit-width` (px) on it, the width each item may take. The grid inside lays its columns
 * at that width (`grid-template-columns: repeat(auto-fill, var(--fit-width))`). Never narrower than `fitMin` (then the
 * element scrolls) nor wider than `fitMax`.
 *
 * <div class="scroll" [erasFitWidth]="cards.length" [fitGap]="8"><div class="grid">…</div></div>
 */
@Directive({
  selector: '[erasFitWidth]',
  host: { '[style.--fit-width.px]': 'width()' },
})
export class FitWidthDirective {
  /** How many items. */
  readonly erasFitWidth = input.required<number>();
  /** An item's width / height (a card: 63 / 88). */
  readonly fitRatio = input(63 / 88);
  /** Space between items, px (the grid's gap). */
  readonly fitGap = input(8);
  readonly fitMin = input(40);
  readonly fitMax = input(260);

  private readonly room = signal({ width: 0, height: 0 });
  // Too little room for any size (or not measured yet): the smallest, and the element scrolls
  protected readonly width = computed(() => {
    const { width, height } = this.room();
    const fit = fitItemWidth(this.erasFitWidth(), width, height, this.fitRatio(), this.fitGap(), this.fitMax());
    return Math.max(this.fitMin(), fit);
  });

  constructor() {
    const element = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    const measure = () => {
      const style = getComputedStyle(element);
      const px = (value: string) => parseFloat(value) || 0;
      this.room.set({
        width: element.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
        height: element.clientHeight - px(style.paddingTop) - px(style.paddingBottom),
      });
    };
    // Measured once painted, then on every change of the element's size
    afterNextRender(() => {
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
