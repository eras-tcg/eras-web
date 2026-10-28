import { CardMeta } from '../cards/card.model';

/**
 * Assisted effects (level 1): turns the text of a card effect into the basic actions it asks for, so the
 * simulator can offer them as buttons. Nothing is resolved automatically: the player decides when to use
 * each action and makes every choice; the engine only does the mechanical part.
 *
 * Effects are free text (es), so this matches the recurring phrases; anything else stays as text.
 */

/** Card filter for searches ("1 carta Azul o Blanca", "1 [dragón] nivel 1", "fuerza 5 o menos"). */
export interface CardFilter {
  /** Color codes (B, G, P, R, W); empty = any. */
  colors: string[];
  /** Classes without brackets ("ente", "dragón"); empty = any. */
  classes: string[];
  level?: number;
  maxLevel?: number;
  maxStrength?: number;
}

export type EffectAction =
  | { kind: 'mill'; count: number }
  | { kind: 'draw'; count: number }
  | { kind: 'handToTributes'; count: number; upTo: boolean }
  | { kind: 'handToDeckTop'; count: number; upTo: boolean }
  | { kind: 'takeFromTributes'; count: number; upTo: boolean; filter: CardFilter }
  | { kind: 'lookTop'; look: number; take: number; filter: CardFilter }
  | { kind: 'tributesToDeckBottom'; count: number; filter: CardFilter }
  | { kind: 'reduceStrength'; amount: number; all: boolean; untilOpponentTurn: boolean }
  | { kind: 'gainStrength'; amount: number }
  | { kind: 'destroy'; count: number; upTo: boolean; filter: CardFilter }
  | { kind: 'untapSelf' }
  | { kind: 'untapAlly'; filter: CardFilter }
  | { kind: 'gainGem'; count: number }
  | { kind: 'deckTopToLife'; faceUp: boolean }
  | { kind: 'damage'; amount: number }
  | { kind: 'tributesToDeckTop'; count: number }
  | { kind: 'summon'; count: number; from: 'hand' | 'tributeZone'; filter: CardFilter }
  | { kind: 'materialsToTributes'; count: number; upTo: boolean }
  | { kind: 'sacrifice' }
  | { kind: 'destroyLife' };

export interface EffectText {
  /** "En Invocación", "Al Atacar"…; empty when the card does not say. */
  instance: string;
  text: string;
  /** Comes from a material below (evolution inheritance). */
  inherited: boolean;
  usageLimit: string | null;
}

const COLOR_WORDS: [RegExp, string][] = [
  [/^az[uú]l(es)?$/i, 'B'],
  [/^verdes?$/i, 'G'],
  [/^violett?as?$/i, 'P'],
  [/^roj[ao]s?$/i, 'R'],
  [/^blanc[ao]s?$/i, 'W'],
];

const NUM = '(\\d+)';

/** Colors and [classes] mentioned in a short phrase ("Azules o Blancas", "Verde o [dragón] nivel 1"). */
export function parseFilter(phrase: string): CardFilter {
  const colors: string[] = [];
  for (const word of phrase.split(/[\s,]+/)) {
    for (const [re, code] of COLOR_WORDS) if (re.test(word) && !colors.includes(code)) colors.push(code);
  }
  const classes = [...phrase.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim().toLowerCase());
  const filter: CardFilter = { colors, classes };
  const maxLevel = phrase.match(/nivel (\d+) o menor/i);
  const level = phrase.match(/nivel (\d+)(?! o menor)/i);
  const maxStrength = phrase.match(/fuerza (\d+) o menos/i);
  if (maxLevel) filter.maxLevel = +maxLevel[1];
  else if (level) filter.level = +level[1];
  if (maxStrength) filter.maxStrength = +maxStrength[1];
  return filter;
}

/** Basic actions found in one effect text, in reading order (duplicates removed). */
export function effectActions(text: string): EffectAction[] {
  const found: { at: number; action: EffectAction }[] = [];
  const add = (re: RegExp, make: (m: RegExpExecArray) => EffectAction | null) => {
    for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      const action = make(m as RegExpExecArray);
      if (action) found.push({ at: m.index ?? 0, action });
    }
  };

  // Tolerates the typos found in the data ("catas", "de del tope")
  add(new RegExp(`tributa(?:r)? ${NUM} ca?r?tas? (?:de )?del tope de tu mazo`, 'i'), (m) => ({ kind: 'mill', count: +m[1] }));
  add(new RegExp(`roba(?:r)? ${NUM} cartas?`, 'i'), (m) => ({ kind: 'draw', count: +m[1] }));
  add(new RegExp(`tributa(?:r)? (hasta )?${NUM} cartas? de tu mano`, 'i'), (m) => ({ kind: 'handToTributes', count: +m[2], upTo: !!m[1] }));
  add(new RegExp(`coloca(?:r)? (hasta )?${NUM} cartas? de tu mano al tope de tu mazo`, 'i'), (m) => ({
    kind: 'handToDeckTop',
    count: +m[2],
    upTo: !!m[1],
  }));
  add(new RegExp(`mira las primeras ${NUM} cartas de tu mazo: de ellas toma hasta ${NUM} cartas? ([^.]+?)\\.`, 'i'), (m) => ({
    kind: 'lookTop',
    look: +m[1],
    take: +m[2],
    filter: parseFilter(m[3]),
  }));
  add(new RegExp(`tomar? (hasta )?${NUM} (cartas? )?([^.;:]*?)de tus tributos`, 'i'), (m) => ({
    kind: 'takeFromTributes',
    count: +m[2],
    upTo: !!m[1],
    filter: parseFilter(m[4]),
  }));
  add(new RegExp(`enviar ${NUM} (?:criaturas |cartas )?(?:de tus tributos )?([^.;:]*?)(?:de tus tributos )?al fondo de tu mazo`, 'i'), (m) => ({
    kind: 'tributesToDeckBottom',
    count: +m[1],
    filter: parseFilter(m[2]),
  }));
  add(/reduc\w*(?: en)? (\d+) (?:la |su )?fuerza|reduc\w* su fuerza en (\d+)|reducir su fuerza en (\d+)/i, (m) => ({
    kind: 'reduceStrength',
    amount: +(m[1] ?? m[2] ?? m[3]),
    all: /todos los enemigos/i.test(text),
    untilOpponentTurn: /final del (turno oponente|próximo turno)/i.test(text),
  }));
  add(/gana fuerza (\d+)/i, (m) => ({ kind: 'gainStrength', amount: +m[1] }));
  add(/el(?:egir|ige) (hasta )?(\d+) enemigos? ([^:;.]*?)[:;]+ ?destrú/i, (m) => ({
    kind: 'destroy',
    count: +m[2],
    upTo: !!m[1],
    filter: parseFilter(m[3]),
  }));
  add(/destruir \d+ carta boca ?a?rriba en las vidas/i, () => ({ kind: 'destroyLife' }));
  add(new RegExp(`coloca(?:r)? (?:hasta )?${NUM} cartas? de tus tributos al tope de tu mazo`, 'i'), (m) => ({ kind: 'tributesToDeckTop', count: +m[1] }));
  // Normal summons only: special summons (Evolución, Ritual…) go through the board's own flow
  add(/invoca(?:r)? (\d+) (?:criatura )?((?:(?!por )[^.;:])*?)(?:de|en) (tu mano|tus tributos)/i, (m) =>
    /por (evoluci|ritual|ascenso|materializaci)/i.test(m[0])
      ? null
      : { kind: 'summon', count: +m[1], from: /mano/i.test(m[3]) ? 'hand' : 'tributeZone', filter: parseFilter(m[2]) },
  );
  add(/tributa(?:r)? (hasta )?(\d+) materiale?s? de esta carta/i, (m) => ({ kind: 'materialsToTributes', count: +m[2], upTo: !!m[1] }));
  add(/sacrificar (?:1 aliado|esta carta)/i, () => ({ kind: 'sacrifice' }));
  add(/reactiva(?:r)? esta carta/i, () => ({ kind: 'untapSelf' }));
  add(/reactiva 1 aliado([^.;]*)/i, (m) => ({ kind: 'untapAlly', filter: parseFilter(m[1]) }));
  add(/gana(?:r)? (\d+) gemas?/i, (m) => ({ kind: 'gainGem', count: +m[1] }));
  add(/coloca la carta del tope de tu mazo al tope de tus vidas (boca ?a?rriba|boca ?a?bajo)/i, (m) => ({
    kind: 'deckTopToLife',
    faceUp: /arriba/i.test(m[1]),
  }));
  add(/infringir (\d+) de daño directo|inflige (\d+) de daño/i, (m) => ({ kind: 'damage', amount: +(m[1] ?? m[2]) }));

  const seen = new Set<string>();
  return found
    .sort((a, b) => a.at - b.at)
    .map((f) => f.action)
    .filter((a) => {
      const key = JSON.stringify(a);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const COLOR_NAMES: Record<string, string> = { B: 'Azul', G: 'Verde', P: 'Violeta', R: 'Roja', W: 'Blanca' };

export function filterLabel(f: CardFilter): string {
  const parts = [...f.colors.map((c) => COLOR_NAMES[c] ?? c), ...f.classes.map((c) => `[${c}]`)];
  let label = parts.join(' o ');
  if (f.level != null) label += ` nivel ${f.level}`;
  if (f.maxLevel != null) label += ` nivel ≤ ${f.maxLevel}`;
  if (f.maxStrength != null) label += ` fuerza ≤ ${f.maxStrength}`;
  return label.trim();
}

/** Button text for an action. */
export function actionLabel(a: EffectAction): string {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  switch (a.kind) {
    case 'mill':
      return `Tributar ${a.count} del tope del mazo`;
    case 'draw':
      return `Robar ${n(a.count, 'carta', 'cartas')}`;
    case 'handToTributes':
      return `Tributar ${a.upTo ? 'hasta ' : ''}${a.count} de la mano`;
    case 'handToDeckTop':
      return `Poner ${a.upTo ? 'hasta ' : ''}${a.count} de la mano en el tope del mazo`;
    case 'takeFromTributes': {
      const f = filterLabel(a.filter);
      return `Tomar ${a.upTo ? 'hasta ' : ''}${a.count} de tributos${f ? ` (${f})` : ''}`;
    }
    case 'lookTop': {
      const f = filterLabel(a.filter);
      return `Mirar ${a.look} del tope y tomar hasta ${a.take}${f ? ` (${f})` : ''}`;
    }
    case 'tributesToDeckBottom': {
      const f = filterLabel(a.filter);
      return `Enviar ${a.count} tributos${f ? ` ${f}` : ''} al fondo del mazo`;
    }
    case 'reduceStrength':
      return `Reducir ${a.amount} la fuerza de ${a.all ? 'los enemigos' : '1 enemigo'}`;
    case 'gainStrength':
      return `Esta carta gana ${a.amount} de fuerza`;
    case 'destroy': {
      const f = filterLabel(a.filter);
      return `Destruir ${a.upTo ? 'hasta ' : ''}${n(a.count, 'enemigo', 'enemigos')}${f ? ` (${f})` : ''}`;
    }
    case 'untapSelf':
      return 'Reactivar esta carta';
    case 'untapAlly': {
      const f = filterLabel(a.filter);
      return `Reactivar 1 aliado${f ? ` (${f})` : ''}`;
    }
    case 'gainGem':
      return `Ganar ${n(a.count, 'gema', 'gemas')}`;
    case 'deckTopToLife':
      return `Tope del mazo a vidas (${a.faceUp ? 'boca arriba' : 'boca abajo'})`;
    case 'damage':
      return `${a.amount} de daño directo`;
    case 'tributesToDeckTop':
      return `Poner ${a.count} de tributos en el tope del mazo`;
    case 'summon': {
      const f = filterLabel(a.filter);
      return `Invocar ${a.count} de ${a.from === 'hand' ? 'la mano' : 'tributos'}${f ? ` (${f})` : ''}`;
    }
    case 'materialsToTributes':
      return `Tributar ${a.upTo ? 'hasta ' : ''}${a.count} ${a.count === 1 ? 'material' : 'materiales'} de esta carta`;
    case 'sacrifice':
      return 'Sacrificar 1 aliado';
    case 'destroyLife':
      return 'Destruir 1 vida boca arriba del rival';
  }
}

/** What a card in the catalog looks like to a filter. */
export interface FilterableCard {
  colorIdentity?: string | null;
  colors?: string[] | null;
  classes?: string[] | null;
  level?: number | null;
  strength?: number | null;
}

/** Colors and classes are alternatives (any of them); level and strength limits must all hold. */
export function matchesFilter(card: FilterableCard, f: CardFilter): boolean {
  const colors = new Set([card.colorIdentity, ...(card.colors ?? [])].filter((c): c is string => !!c));
  const classes = (card.classes ?? []).map((c) => c.toLowerCase());
  const anyOf = f.colors.length + f.classes.length;
  if (anyOf && !f.colors.some((c) => colors.has(c)) && !f.classes.some((c) => classes.includes(c))) return false;
  if (f.level != null && card.level !== f.level) return false;
  if (f.maxLevel != null && (card.level == null || card.level > f.maxLevel)) return false;
  if (f.maxStrength != null && (card.strength == null || card.strength > f.maxStrength)) return false;
  return true;
}

/**
 * Effects a card offers: its own, plus the inherited effects of the cards under it (its materials, for
 * evolutions). Empty texts are dropped.
 */
export function cardEffectTexts(own: CardMeta | null, under: readonly (CardMeta | null)[] = []): EffectText[] {
  const texts: EffectText[] = [];
  const push = (list: CardMeta['effects'], inherited: boolean) => {
    for (const e of list ?? []) {
      const text = (e.effectBlocks ?? [])
        .map((b) => [b.activationCondition, b.cost, b.resolution].filter((part) => !!part?.trim()).join(' '))
        .filter((block) => block)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;
      texts.push({ instance: e.instance ?? '', text, inherited, usageLimit: e.ussageLimit ?? null });
    }
  };
  push(own?.effects, false);
  for (const m of under) push(m?.inheritEffects, true);
  return texts;
}
