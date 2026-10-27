import { BoxConfig, BoxEntry, Edition } from './edition.model';

/** Starter decks (ST*) first, then by edition number (E1, E1.1, E1.2, E2...). */
export function compareEditionIds(a: string, b: string): number {
  const aStarter = a.startsWith('ST');
  const bStarter = b.startsWith('ST');
  if (aStarter !== bStarter) return aStarter ? -1 : 1;
  return parseFloat(a.replace(/[^0-9.]/g, '')) - parseFloat(b.replace(/[^0-9.]/g, ''));
}

export function sortEditions(editions: readonly Edition[]): Edition[] {
  return [...editions].sort((x, y) => compareEditionIds(x.editionId, y.editionId));
}

export function probabilitySum(entry: BoxEntry): number {
  return entry.probOptions.reduce((sum, option) => sum + (Number(option.prob) || 0), 0);
}

/** Validates a box configuration. Returns an error message, or null when valid. */
export function validateBoxConfig(box: BoxConfig): string | null {
  const { totalPacks, entries } = box;
  if (!entries.length) return null; // no box config is allowed

  const flex = entries.filter((e) => e.mode === 'FLEX');
  const prob = entries.filter((e) => e.mode === 'PROB');

  if (flex.length > 1) return 'Solo puede haber una entrada FLEX en la caja.';
  if (prob.length > 0 && flex.length === 0) return 'Se requiere una entrada FLEX cuando hay entradas PROB.';

  for (const entry of prob) {
    const sum = probabilitySum(entry);
    if (Math.abs(sum - 1) > 0.001) {
      return `Las probabilidades del sobre "${entry.packTypeName}" suman ${sum.toFixed(3)}, deben sumar 1.`;
    }
  }

  const fixedTotal = entries
    .filter((e) => e.mode === 'FIXED')
    .reduce((sum, e) => sum + (Math.trunc(Number(e.quantity)) || 0), 0);
  const probMinimum = prob.reduce((sum, e) => {
    const min = Math.min(...e.probOptions.map((o) => Math.trunc(Number(o.quantity)) || 0));
    return sum + (Number.isFinite(min) ? min : 0);
  }, 0);
  if (fixedTotal + probMinimum > totalPacks) {
    return `El mínimo de sobres asignados (${fixedTotal + probMinimum}) supera el total de la caja (${totalPacks}).`;
  }
  return null;
}

/**
 * Simulates one full box and returns one random pack name from it, so the
 * odds of a single random pack match the real box composition.
 */
export function pickRandomPackFromBox(edition: Edition, random: () => number = Math.random): string {
  const fallback = edition.packTypes?.[0]?.name ?? '';
  const entries = edition.boxConfig?.entries ?? [];
  const totalPacks = edition.boxConfig?.totalPacks ?? 0;
  if (!totalPacks || !entries.length) return fallback;

  const pool: string[] = [];

  for (const entry of entries.filter((e) => e.mode === 'FIXED')) {
    for (let i = 0; i < (entry.quantity || 0); i++) pool.push(entry.packTypeName);
  }

  for (const entry of entries.filter((e) => e.mode === 'PROB')) {
    if (!entry.probOptions.length) continue;
    const roll = random();
    let cumulative = 0;
    let chosen = entry.probOptions[entry.probOptions.length - 1].quantity;
    for (const option of entry.probOptions) {
      cumulative += Number(option.prob) || 0;
      if (roll <= cumulative) {
        chosen = option.quantity || 0;
        break;
      }
    }
    for (let i = 0; i < chosen; i++) pool.push(entry.packTypeName);
  }

  const flex = entries.find((e) => e.mode === 'FLEX');
  if (flex) {
    const remaining = Math.max(0, totalPacks - pool.length);
    for (let i = 0; i < remaining; i++) pool.push(flex.packTypeName);
  }

  return pool.length ? pool[Math.floor(random() * pool.length)] : fallback;
}

/** An edition can simulate a single pack when it has pack types, and a box when it also has a box config. */
export function canSimulatePack(edition: Edition): boolean {
  return (edition.packTypes?.length ?? 0) > 0;
}

export function canSimulateBox(edition: Edition): boolean {
  return canSimulatePack(edition) && (edition.boxConfig?.entries?.length ?? 0) > 0;
}
