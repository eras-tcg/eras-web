import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FitWidthDirective } from './fit-width.directive';

@Component({
  imports: [FitWidthDirective],
  template: `<div [erasFitWidth]="count()" [fitMin]="40" [fitMax]="260"></div>`,
})
class HostComponent {
  readonly count = signal(50);
}

describe('FitWidthDirective', () => {
  it('starts at the smallest width before it measures (never at the largest)', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const div = fixture.nativeElement.querySelector('div') as HTMLElement;
    expect(div.style.getPropertyValue('--fit-width')).toBe('40px');
  });
});
