import { BoxConfig, BoxEntry, Edition, CoverFrame } from './edition.model';

/**
 * A testing edition ("T1", "T1.2"): cards with no edition yet. The backend shows them only to players with the
 * test_cards permission; they are never sold nor listed among the editions.
 */
export function isTestEdition(editionId: string | null | undefined): boolean {
  return !!editionId && /^T\d+(?:\.\d+)?$/i.test(editionId.trim());
}

/**
 * Whether an admin hid the edition (in development), by itself or by its base edition: hiding E3 hides E3.1, as the
 * server does. Only admins and testers ever receive a hidden edition.
 */
export function isHiddenEdition(editionId: string, editions: readonly Edition[]): boolean {
  const id = editionId.trim().toUpperCase();
  const base = id.split('.')[0];
  return editions.some((e) => !!e.hidden && [id, base].includes(e.editionId.trim().toUpperCase()));
}

/** Starter decks (ST*) first, then by edition number (E1, E1.1, E1.2, E2...), testing editions (T*) last. */
export function compareEditionIds(a: string, b: string): number {
  const aStarter = a.startsWith('ST');
  const bStarter = b.startsWith('ST');
  if (aStarter !== bStarter) return aStarter ? -1 : 1;
  const aTest = isTestEdition(a);
  const bTest = isTestEdition(b);
  if (aTest !== bTest) return aTest ? 1 : -1;
  return parseFloat(a.replace(/[^0-9.]/g, '')) - parseFloat(b.replace(/[^0-9.]/g, ''));
}

/**
 * Editions by release date (ST1–4, E1…E1.3, ST5–8, E2…); an edition without a date goes after the dated ones, by
 * compareEditionIds, and the testing editions last.
 */
export function sortEditions(editions: readonly Edition[]): Edition[] {
  return [...editions].sort((x, y) => {
    const xTest = isTestEdition(x.editionId);
    if (xTest !== isTestEdition(y.editionId)) return xTest ? 1 : -1;
    const xDate = x.releaseDate || '￿';
    const yDate = y.releaseDate || '￿';
    return xDate.localeCompare(yDate) || compareEditionIds(x.editionId, y.editionId);
  });
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

/** The cover as it sits: centered and just covering when it has no framing. */
export const DEFAULT_COVER_FRAME: CoverFrame = { x: 50, y: 50, zoom: 1 };

/** CSS that places a cover in its tile: the framed point stays in view and the image grows around it. */
export function coverFrameStyle(frame: CoverFrame | null | undefined): { position: string; transform: string | null } {
  const f = frame ?? DEFAULT_COVER_FRAME;
  return { position: `${f.x}% ${f.y}%`, transform: f.zoom !== 1 ? `scale(${f.zoom})` : null };
}
