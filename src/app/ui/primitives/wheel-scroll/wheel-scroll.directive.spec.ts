import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WheelScrollXDirective } from './wheel-scroll.directive';

@Component({
  imports: [WheelScrollXDirective],
  template: `<div erasWheelScrollX style="inline-size: 100px; overflow-x: auto; white-space: nowrap"><span style="display: inline-block; inline-size: 500px">x</span></div>`,
})
class HostComponent {}

describe('WheelScrollXDirective', () => {
  it('scrolls an overflowing row sideways with the wheel', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('div') as HTMLElement;
    Object.defineProperty(row, 'scrollWidth', { value: 500 });
    Object.defineProperty(row, 'clientWidth', { value: 100 });
    const event = new WheelEvent('wheel', { deltaY: 40, cancelable: true });
    row.dispatchEvent(event);
    expect(row.scrollLeft).toBe(40);
    expect(event.defaultPrevented).toBe(true);
  });
});
