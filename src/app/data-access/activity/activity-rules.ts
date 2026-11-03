import { ActivityAction, ActivityEntry } from './activity.model';

/** Every action with its name, the group the filter shows it in and its short name there. */
export const ACTIVITY_ACTIONS: readonly { action: ActivityAction; label: string; group: string; short: string }[] = [
  { action: 'LOGIN', label: 'Inicio de sesión', group: 'Ingresos', short: 'Sesión' },
  { action: 'VISIT', label: 'Ingreso del día', group: 'Ingresos', short: 'Del día' },
  { action: 'SHOP_PURCHASE', label: 'Compra en la tienda', group: 'Tienda', short: 'Compras' },
  { action: 'DECK_CREATE', label: 'Mazo creado', group: 'Mazos', short: 'Creado' },
  { action: 'DECK_UPDATE', label: 'Mazo editado', group: 'Mazos', short: 'Editado' },
  { action: 'DECK_DELETE', label: 'Mazo borrado', group: 'Mazos', short: 'Borrado' },
  { action: 'ONLINE_GAME_START', label: 'Partida online iniciada', group: 'Partidas online', short: 'Iniciada' },
  { action: 'ONLINE_GAME_END', label: 'Partida online terminada', group: 'Partidas online', short: 'Terminada' },
  { action: 'SOLO_GAME_START', label: 'Modo solo iniciado', group: 'Modo solo', short: 'Iniciado' },
  { action: 'SOLO_GAME_END', label: 'Modo solo terminado', group: 'Modo solo', short: 'Terminado' },
];

/** The actions by group, in order, as the filter's toggle groups. */
export const ACTIVITY_GROUPS: readonly { name: string; options: { value: ActivityAction; label: string; text: string }[] }[] = [
  ...new Set(ACTIVITY_ACTIONS.map((a) => a.group)),
].map((name) => ({
  name,
  options: ACTIVITY_ACTIONS.filter((a) => a.group === name).map((a) => ({ value: a.action, label: a.label, text: a.short })),
}));

const LABELS = new Map(ACTIVITY_ACTIONS.map((a) => [a.action, a.label]));

const PRODUCTS: Record<string, string> = { pack: 'Sobre', box: 'Booster box', structure: 'Structure deck' };
const RESULTS: Record<string, string> = { won: 'ganó', lost: 'perdió', draw: 'empate' };

export function actionLabel(action: string): string {
  return LABELS.get(action as ActivityAction) ?? action;
}

/** What an event did, in a line (empty when its action says it all). */
export function describeActivity(entry: ActivityEntry): string {
  const d = entry.detail ?? {};
  switch (entry.action) {
    case 'SHOP_PURCHASE':
      return [PRODUCTS[d['product']] ?? d['product'], d['editionId'], d['price'] != null ? `${d['price']} gemas` : null]
        .filter((p) => p != null && p !== '')
        .join(' · ');
    case 'DECK_CREATE':
    case 'DECK_UPDATE':
    case 'DECK_DELETE':
      return String(d['deckName'] ?? '');
    case 'ONLINE_GAME_START':
    case 'ONLINE_GAME_END':
      return [d['rival'] ? `vs ${d['rival']}` : null, RESULTS[d['result']] ?? null].filter(Boolean).join(' · ');
    default:
      return '';
  }
}

/**
 * A day range of date inputs ("yyyy-mm-dd", local time) as the inclusive instants the API filters by: from the start
 * of `from` to the end of `to`. An empty or invalid date leaves that side open.
 */
export function dayRange(from: string, to: string): { from: string | null; to: string | null } {
  const start = parseDay(from);
  const end = parseDay(to);
  if (end) end.setHours(23, 59, 59, 999);
  return { from: start?.toISOString() ?? null, to: end?.toISOString() ?? null };
}

function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(date.getTime()) ? null : date;
}

/** A date as a date input's value ("yyyy-mm-dd", local time). */
export function dayValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
