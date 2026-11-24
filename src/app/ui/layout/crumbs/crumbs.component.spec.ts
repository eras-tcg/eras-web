import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CrumbsComponent } from './crumbs.component';

@Component({
  imports: [CrumbsComponent],
  template: `
    <eras-crumbs>
      <button crumbs-back type="button">Mazos</button>
      <ng-container crumbs-here>Aggro</ng-container>
      <button class="extra" type="button">Editar</button>
    </eras-crumbs>
  `,
})
class HostComponent {}

describe('CrumbsComponent', () => {
  it('puts the way back, then the current place, then the rest', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const trail = el.querySelector('nav.trail')!;
    expect(trail.getAttribute('aria-label')).toBe('Ubicación');
    expect(trail.querySelector('[crumbs-back]')?.textContent).toBe('Mazos');
    expect(trail.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('Aggro');
    // Actions stay outside the trail
    expect(trail.querySelector('.extra')).toBeNull();
    expect(el.querySelector('eras-crumbs > .extra')).not.toBeNull();
  });
});
