import { TestBed } from '@angular/core/testing';
import { CardFaceComponent } from './card-face.component';

function face(inputs: Record<string, unknown>): HTMLElement {
  const fixture = TestBed.createComponent(CardFaceComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CardFaceComponent', () => {
  it('draws the picture with its still shine and foil', () => {
    const el = face({ src: '/api/cards/abc/render?v=1', foil: 'prism' });
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/api/cards/abc/render?v=1');
    expect((el.querySelector('.gloss') as HTMLElement).style.getPropertyValue('--card-shine')).toContain(
      '/api/cards/abc/shine?v=1',
    );
    expect(el.querySelector('.foil')?.classList).toContain('prism');
    expect(el.querySelector('.back')).toBeNull();
  });

  it('takes the given shine, or none', () => {
    const given = face({ src: 'blob:x', shineSrc: '/s.png' });
    expect((given.querySelector('.gold') as HTMLElement).style.getPropertyValue('--card-shine')).toContain('/s.png');
    expect(face({ src: '/api/cards/abc/render', noShine: true }).querySelector('.gloss')).toBeNull();
  });

  it('shines through the masks drawn at its size instead of the shine PNG', () => {
    const el = face({ src: '/api/cards/abc/render', masks: { gloss: 'data:g', gold: null } });
    expect(el.querySelector('.gloss.full')).not.toBeNull();
    expect((el.querySelector('.gloss') as HTMLElement).style.getPropertyValue('--card-shine')).toContain('data:g');
    expect(el.querySelector('.gold')).toBeNull();
  });

  it('shows its back face down, and over a corner when peeked', () => {
    const down = face({ src: '/a.jpg', hidden: true });
    expect(down.querySelector('img')).toBeNull();
    expect(down.querySelector('.back')).not.toBeNull();
    expect(face({ src: '/a.jpg', peeked: true }).querySelector('.back.peek')).not.toBeNull();
  });

  it('writes its name when it has no picture', () => {
    expect(face({ name: 'Carta de prueba' }).querySelector('.missing')?.textContent).toContain('Carta de prueba');
  });

  it('has its thickness only when live', () => {
    expect(face({ src: '/a.jpg' }).querySelector('.edge')).toBeNull();
    expect(face({ src: '/a.jpg', live: true }).querySelectorAll('.edge').length).toBeGreaterThan(0);
  });
});
