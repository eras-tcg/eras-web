import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { apiErrorMessage, fieldErrors } from './api-error';

const http = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('apiErrorMessage', () => {
  it('reads string, error and message bodies, translating known server messages', () => {
    expect(apiErrorMessage(http(401, 'Error: Invalid credentials'))).toBe('Invalid credentials');
    expect(apiErrorMessage(http(400, { error: 'Email should be valid' }))).toBe('Ingresa un correo válido');
    expect(apiErrorMessage(http(400, '{"message":"Password is required"}'))).toBe('Ingresa una contraseña');
  });

  it('translates "Error: "-prefixed service errors', () => {
    expect(apiErrorMessage(http(500, 'Error: Old password is incorrect'))).toBe('La contraseña actual no es correcta');
    expect(apiErrorMessage(http(400, { error: 'Invalid verification token' }))).toBe('El enlace de verificación es inválido o ya se usó.');
  });

  it('explains network failures', () => {
    expect(apiErrorMessage(http(0, null))).toBe('No hay conexión con el servidor');
  });
});

describe('fieldErrors', () => {
  it('maps Spring validation errors per field, also from unparsed text bodies', () => {
    expect(fieldErrors(http(400, '{"username":"Username must be between 3 and 20 characters","email":"Email is required"}'))).toEqual({
      username: 'El usuario debe tener entre 3 y 20 caracteres',
      email: 'Ingresa tu correo',
    });
  });

  it('ignores generic errors and other statuses', () => {
    expect(fieldErrors(http(400, { error: 'Username already exists' }))).toEqual({});
    expect(fieldErrors(http(500, { username: 'x' }))).toEqual({});
  });
});
