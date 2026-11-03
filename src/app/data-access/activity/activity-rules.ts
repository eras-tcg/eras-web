import { ActivityAction, ActivityEntry } from './activity.model';

/** Every action, in the order the filter lists them, with its name. */
export const ACTIVITY_ACTIONS: readonly { action: ActivityAction; label: string }[] = [
  { action: 'LOGIN', label: 'Inicio de sesión' },
  { action: 'VISIT', label: 'Ingreso del día' },
  { action: 'SHOP_PURCHASE', label: 'Compra en la tienda' },
  { action: 'DECK_CREATE', label: 'Mazo creado' },
  { action: 'DECK_UPDATE', label: 'Mazo editado' },
  { action: 'DECK_DELETE', label: 'Mazo borrado' },
  { action: 'ONLINE_GAME_START', label: 'Partida online iniciada' },
  { action: 'ONLINE_GAME_END', label: 'Partida online terminada' },
  { action: 'SOLO_GAME_START', label: 'Modo solo iniciado' },
  { action: 'SOLO_GAME_END', label: 'Modo solo terminado' },
];

const LABELS = new Map(ACTIVITY_ACTIONS.map((a) => [a.action, a.label]));
const BY_LABEL = new Map(ACTIVITY_ACTIONS.map((a) => [a.label, a.action]));

const PRODUCTS: Record<string, string> = { pack: 'Sobre', box: 'Booster box', structure: 'Structure deck' };
const RESULTS: Record<string, string> = { won: 'ganó', lost: 'perdió', draw: 'empate' };

export function actionLabel(action: string): string {
  return LABELS.get(action as ActivityAction) ?? action;
}

/** The actions behind the names chosen in the filter. */
export function actionsOf(labels: readonly string[]): ActivityAction[] {
  return labels.map((l) => BY_LABEL.get(l)).filter((a): a is ActivityAction => !!a);
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
