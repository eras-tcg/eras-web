import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageComponent } from './page.component';

@Component({
  imports: [PageComponent],
  template: `<eras-page title="Cartas" />`,
})
class HostComponent {}

describe('PageComponent', () => {
  // The page carries the screen bar ("back" and the quick buttons): it needs the router and the session
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }));

  it('shows its title as the heading, not as the browser tooltip of the whole page', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement.querySelector('eras-page');
    expect(page.hasAttribute('title')).toBe(false);
    expect(page.textContent).toContain('Cartas');
  });
});
