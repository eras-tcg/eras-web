import { HttpErrorResponse } from '@angular/common/http';

/** Turns any backend or network error into a readable message (same rules as the Vue app). */
export function apiErrorMessage(error: unknown, fallback = 'Ocurrió un error'): string {
  if (error instanceof HttpErrorResponse) {
    const data = errorBody(error);
    if (typeof data === 'string' && data.trim()) return translateServerMessage(data.replace(/^Error: /, ''));
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record['error'] === 'string') return translateServerMessage(record['error']);
      if (typeof record['message'] === 'string') return translateServerMessage(record['message']);
      const firstText = Object.values(record).find((v): v is string => typeof v === 'string');
      if (firstText) return translateServerMessage(firstText);
    }
    if (error.status === 0) return 'No hay conexión con el servidor';
    if (error.status === 401) return 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión.';
    if (error.status === 403) return 'No tienes permiso para hacer esto.';
    if (error.status === 404) return `${fallback} (no encontrado)`;
    // Angular's own message ("Http failure response for …") is not meant for users
    return error.status >= 500 ? `${fallback}: error del servidor` : fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Validation errors keyed by field, from a `{ field: "message" }` 400 response
 * (Spring BindingResult). Empty when the error is not of that shape.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return {};
  const data = errorBody(error);
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [field, message] of Object.entries(data as Record<string, unknown>)) {
    if (field !== 'error' && field !== 'message' && typeof message === 'string') out[field] = translateServerMessage(message);
  }
  return out;
}

/** Requests made with `responseType: 'text'` get JSON error bodies as unparsed strings. */
function errorBody(error: HttpErrorResponse): unknown {
  const data: unknown = error.error;
  if (typeof data === 'string' && data.trim().startsWith('{')) {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

// UsersService answers in English; these are its validation messages (limits come from its configuration)
const SERVER_MESSAGES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Username is required$/, () => 'Ingresa un nombre de usuario'],
  [/^Username must be between (\d+) and (\d+) characters$/, (m) => `El usuario debe tener entre ${m[1]} y ${m[2]} caracteres`],
  [/^Username can only contain letters, numbers, and underscores$/, () => 'El usuario solo puede tener letras, números y guion bajo'],
  [/^Password is required$/, () => 'Ingresa una contraseña'],
  [/^Password must be between (\d+) and (\d+) characters$/, (m) => `La contraseña debe tener entre ${m[1]} y ${m[2]} caracteres`],
  [/^Password must contain at least one uppercase letter$/, () => 'La contraseña debe tener al menos una mayúscula'],
  [/^Password must contain at least one lowercase letter$/, () => 'La contraseña debe tener al menos una minúscula'],
  [/^Password must contain at least one digit$/, () => 'La contraseña debe tener al menos un número'],
  [/^Password must contain at least one special character \((.*)\)$/, (m) => `La contraseña debe tener al menos un carácter especial (${m[1]})`],
  [/^Email is required$/, () => 'Ingresa tu correo'],
  [/^Email should be valid$/, () => 'Ingresa un correo válido'],
  [/^Username already exists$/, () => 'Ese nombre de usuario ya está en uso'],
  [/^Email already exists$/, () => 'Ese correo ya está registrado'],
  // The account is saved before the e-mail is sent, so it exists but cannot be verified yet
  [/^Failed to send verification email$/, () => 'La cuenta se creó, pero no pudimos enviar el correo de verificación. Contacta a un administrador para activarla.'],
  [/^Account not verified\. Please check your email\.$/, () => 'Tu cuenta aún no está verificada. Revisa tu correo.'],
  [/^Invalid verification token$/, () => 'El enlace de verificación es inválido o ya se usó.'],
  [/^Old password is incorrect$/, () => 'La contraseña actual no es correcta'],
  [/^New password cannot be the same as the old password$/, () => 'La nueva contraseña debe ser distinta de la actual'],
  [/^Both old and new passwords must be provided$/, () => 'Ingresa la contraseña actual y la nueva'],
  [/^Invalid password$/, () => 'Contraseña incorrecta'],
  [/^User not found$/, () => 'Usuario no encontrado'],
];

export function translateServerMessage(message: string): string {
  for (const [pattern, translate] of SERVER_MESSAGES) {
    const match = message.match(pattern);
    if (match) return translate(match);
  }
  return message;
}
