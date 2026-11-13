import { TestBed } from '@angular/core/testing';
import { ZoneBoxComponent } from './zone-box.component';

describe('ZoneBoxComponent', () => {
  it('names the zone over its cards, and none when it has no label', () => {
    const fixture = TestBed.createComponent(ZoneBoxComponent);
    fixture.componentRef.setInput('label', 'Mano');
    fixture.componentRef.setInput('icon', 'zone-hand');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.zone-name')?.textContent?.trim()).toBe('Mano');
    expect(el.getAttribute('aria-label')).toBe('Mano');
    fixture.componentRef.setInput('label', null);
    fixture.componentRef.setInput('bare', true);
    fixture.detectChanges();
    expect(el.querySelector('.zone-name')).toBeNull();
    expect(el.classList).toContain('bare');
  });
});
