import { TestBed } from '@angular/core/testing';
import { CardFactsComponent } from './card-facts.component';

describe('CardFactsComponent', () => {
  it('writes each fact as a label over its value, marking the changed and wide ones', () => {
    const fixture = TestBed.createComponent(CardFactsComponent);
    fixture.componentRef.setInput('facts', [
      { label: 'Nivel', value: '2' },
      { label: 'Fuerza', value: '5', changed: true },
      { label: 'Requerimiento', value: 'Un Paladín en el campo', wide: true },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const facts = [...el.querySelectorAll('.fact')];
    expect(facts.map((f) => `${f.querySelector('dt')?.textContent}=${f.querySelector('dd')?.textContent}`)).toEqual([
      'Nivel=2',
      'Fuerza=5',
      'Requerimiento=Un Paladín en el campo',
    ]);
    expect(facts[1].classList).toContain('changed');
    expect(facts[2].classList).toContain('wide');
  });
});
