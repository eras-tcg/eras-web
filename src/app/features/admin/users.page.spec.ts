import { HttpErrorResponse } from '@angular/common/http';
import { registrationError } from './users.page';

describe('registrationError', () => {
  it('translates the field errors of UsersService', () => {
    const e = new HttpErrorResponse({
      status: 400,
      error: { password: 'Password must be at least 8 characters', email: 'Email should be valid' },
    });
    expect(registrationError(e)).toBe('La contraseña debe tener al menos 8 caracteres. El correo no es válido');
  });

  it('translates its single error, also when it comes as text', () => {
    expect(registrationError(new HttpErrorResponse({ status: 400, error: { error: 'Username already exists' } }))).toBe('Ese nombre de usuario ya existe');
    expect(registrationError(new HttpErrorResponse({ status: 400, error: '{"error":"Email already exists"}' }))).toBe('Ese correo ya tiene una cuenta');
  });
});
