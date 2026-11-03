/**
 * A password only needs PASSWORD_MIN_LENGTH characters, of any kind (UsersService checks the same).
 * PASSWORD_MAX_LENGTH is the server's technical cap.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

/** What is wrong with a password, in Spanish, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  if (!password) return 'Ingresa una contraseña';
  if (password.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  if (password.length > PASSWORD_MAX_LENGTH) return `La contraseña puede tener hasta ${PASSWORD_MAX_LENGTH} caracteres`;
  return null;
}
