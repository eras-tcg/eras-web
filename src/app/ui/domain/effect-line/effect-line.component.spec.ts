import { TestBed } from '@angular/core/testing';
import { EffectLineComponent } from './effect-line.component';

describe('EffectLineComponent', () => {
  const render = (inputs: Record<string, unknown>) => {
    const fixture = TestBed.createComponent(EffectLineComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const chips = (el: HTMLElement) => [...el.querySelectorAll('.chip')].map((c) => `${c.className.replace('chip ', '')}:${c.textContent?.trim()}`);

  it('writes the text alone when the effect has no source, moment or tags', () => {
    const el = render({ text: 'Roba 1 carta.' });
    expect(el.querySelector('.chips')).toBeNull();
    expect(el.querySelector('p')?.textContent).toBe('Roba 1 carta.');
  });

  it('puts the source first, then the moment and the tags', () => {
    const el = render({ text: 'Gana +1 de fuerza.', source: 'Recurso X', moment: 'Al Atacar', tags: ['una vez por turno'] });
    expect(chips(el)).toEqual(['source:Recurso X', 'moment:Al Atacar', 'tag:una vez por turno']);
  });
});
