import { Directive } from '@angular/core';

/**
 * A row that scrolls sideways (overflow-x): the mouse wheel up or down scrolls it too. Only while it overflows and the
 * wheel turns more up/down than sideways (a trackpad's sideways swipe keeps its own scroll).
 */
@Directive({
  selector: '[erasWheelScrollX]',
  host: { '(wheel)': 'wheel($event)' },
})
export class WheelScrollXDirective {
  protected wheel(e: WheelEvent): void {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }
}
