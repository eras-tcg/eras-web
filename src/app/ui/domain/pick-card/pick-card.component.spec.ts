import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PickCardComponent, PickCardTone } from './pick-card.component';

@Component({
  imports: [PickCardComponent],
  template: `<button erasPickCard type="button" [chosen]="chosen()" [mark]="mark()" [order]="order()" [tone]="tone()" [viewOnly]="viewOnly()">Carta</button>`,
})
class HostComponent {
  readonly chosen = signal(false);
  readonly mark = signal<number | null>(null);
  readonly order = signal<number | null>(null);
  readonly tone = signal<PickCardTone>('success');
  readonly viewOnly = signal(false);
}

describe('PickCardComponent', () => {
  const render = (set: (h: HostComponent) => void = () => undefined) => {
    const fixture = TestBed.createComponent(HostComponent);
    set(fixture.componentInstance);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  };

  it('shows no mark while not chosen nor numbered', () => {
    const b = render();
    expect(b.querySelector('.mark')).toBeNull();
    expect(b.getAttribute('aria-pressed')).toBe('false');
  });

  it('chosen: the success frame and a check, or the number it is given', () => {
    let b = render((h) => h.chosen.set(true));
    expect(b.classList).toContain('chosen');
    expect(b.querySelector('.mark eras-icon')).not.toBeNull();
    b = render((h) => {
      h.chosen.set(true);
      h.mark.set(2);
    });
    expect(b.querySelector('.mark')?.textContent?.trim()).toBe('2');
  });

  it('numbered: the order mark in the primary color', () => {
    const b = render((h) => h.order.set(3));
    expect(b.classList).toContain('numbered');
    expect(b.querySelector('.mark.order')?.textContent?.trim()).toBe('3');
    expect(b.getAttribute('aria-pressed')).toBe('true');
  });

  it('danger: chosen without a mark', () => {
    const b = render((h) => {
      h.chosen.set(true);
      h.tone.set('danger');
    });
    expect(b.classList).toContain('danger');
    expect(b.querySelector('.mark')).toBeNull();
  });

  it('view only: no pressed state', () => {
    const b = render((h) => h.viewOnly.set(true));
    expect(b.hasAttribute('aria-pressed')).toBe(false);
  });
});
