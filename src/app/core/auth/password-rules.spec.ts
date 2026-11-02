import { passwordProblem } from './password-rules';

describe('password rules', () => {
  it('only asks for 8 characters, of any kind', () => {
    expect(passwordProblem('abcdefgh')).toBeNull();
    expect(passwordProblem('12345678')).toBeNull();
    expect(passwordProblem('abcdefg')).toBe('La contraseña debe tener al menos 8 caracteres');
    expect(passwordProblem('')).toBe('Ingresa una contraseña');
    expect(passwordProblem('a'.repeat(65))).toBe('La contraseña puede tener hasta 64 caracteres');
  });
});
