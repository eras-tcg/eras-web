import { TestBed } from '@angular/core/testing';
import { SearchFieldComponent } from './search-field.component';

describe('SearchFieldComponent', () => {
  it('shows its value and reports what is typed', () => {
    const fixture = TestBed.createComponent(SearchFieldComponent);
    fixture.componentRef.setInput('label', 'Buscar mazos');
    fixture.componentRef.setInput('value', 'dra');
    fixture.detectChanges();
    const field = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(field.value).toBe('dra');
    expect(field.getAttribute('aria-label')).toBe('Buscar mazos');
    const typed: string[] = [];
    fixture.componentInstance.value.subscribe((v) => typed.push(v));
    field.value = 'dragón';
    field.dispatchEvent(new Event('input'));
    expect(typed).toEqual(['dragón']);
  });
});
