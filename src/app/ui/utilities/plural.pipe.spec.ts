import { describe, expect, it } from 'vitest';
import { PluralPipe } from './plural.pipe';

describe('PluralPipe', () => {
  const pipe = new PluralPipe();

  it('uses the singular only for 1', () => {
    expect(pipe.transform(1, 'nota')).toBe('1 nota');
    expect(pipe.transform(0, 'nota')).toBe('0 notas');
    expect(pipe.transform(25, 'partida')).toBe('25 partidas');
  });

  it('accepts an irregular plural', () => {
    expect(pipe.transform(2, 'valor', 'valores')).toBe('2 valores');
  });
});
