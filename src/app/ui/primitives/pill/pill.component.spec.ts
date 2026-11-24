import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PillComponent } from './pill.component';

@Component({
  imports: [PillComponent],
  template: `<span erasPill>24 cartas</span>`,
})
class HostComponent {}

describe('PillComponent', () => {
  it('keeps the span and its text', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const pill = (fixture.nativeElement as HTMLElement).querySelector('span[erasPill]');
    expect(pill?.textContent).toBe('24 cartas');
  });
});
