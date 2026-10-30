import { IconName } from '@ui/primitives/icon/icon.component';

/** A color identity of the game, the ground of a player's icon. */
export type AvatarColor = 'B' | 'G' | 'P' | 'R' | 'W';

export interface Avatar {
  icon: IconName;
  color: AvatarColor;
}

/** The icons a player can pick, from the game's own world first. */
export const AVATAR_ICONS: readonly { icon: IconName; label: string }[] = [
  { icon: 'creature', label: 'Garras' },
  { icon: 'structure', label: 'Torre' },
  { icon: 'utility', label: 'Frasco' },
  { icon: 'sword', label: 'Espada' },
  { icon: 'shield', label: 'Escudo' },
  { icon: 'skull', label: 'Calavera' },
  { icon: 'gem', label: 'Gema' },
  { icon: 'zap', label: 'Rayo' },
  { icon: 'sparkles', label: 'Destellos' },
  { icon: 'heart', label: 'Corazón' },
  { icon: 'eye', label: 'Ojo' },
  { icon: 'flag', label: 'Estandarte' },
  { icon: 'trophy', label: 'Trofeo' },
  { icon: 'target', label: 'Diana' },
  { icon: 'book', label: 'Libro' },
  { icon: 'layers', label: 'Capas' },
];

export const AVATAR_COLORS: readonly { color: AvatarColor; label: string }[] = [
  { color: 'B', label: 'Azul' },
  { color: 'G', label: 'Verde' },
  { color: 'P', label: 'Violeta' },
  { color: 'R', label: 'Rojo' },
  { color: 'W', label: 'Blanco' },
];

export const DEFAULT_AVATAR: Avatar = { icon: 'creature', color: 'P' };

/** "icon:color" as the profile stores it; anything else (or nothing) is the default icon. */
export function parseAvatar(value: string | null | undefined): Avatar {
  const [icon, color] = (value ?? '').split(':');
  const known = AVATAR_ICONS.some((a) => a.icon === icon) && AVATAR_COLORS.some((c) => c.color === color);
  return known ? { icon: icon as IconName, color: color as AvatarColor } : DEFAULT_AVATAR;
}

export function formatAvatar(avatar: Avatar): string {
  return `${avatar.icon}:${avatar.color}`;
}
