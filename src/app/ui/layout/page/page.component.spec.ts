import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageComponent } from './page.component';

@Component({
  imports: [PageComponent],
  template: `<eras-page title="Cartas" />`,
})
class HostComponent {}

describe('PageComponent', () => {
  it('shows its title as the heading, not as the browser tooltip of the whole page', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement.querySelector('eras-page');
    expect(page.hasAttribute('title')).toBe(false);
    expect(page.textContent).toContain('Cartas');
  });
});
