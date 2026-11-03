import { CatalogCard } from '@data/cards/card.model';
import { Deck } from '@data/decks/deck.model';

/**
 * How each structure deck plays, for the player choosing their first one: a tagline, its philosophy in a few
 * sentences and its style in tags. Drafted from the vault's evaluation of each Structure (04 Cartas/STn/Inicio STn);
 * the designer may rewrite them freely.
 */
export interface StructureStyle {
  /** The color identity it opened (vault: 02 Identidades). */
  color: string;
  tagline: string;
  philosophy: string;
  tags: string[];
}

const STYLES: Record<string, StructureStyle> = {
  ST1: {
    color: 'Azul',
    tagline: 'Domina el tiempo, controla la mesa.',
    philosophy:
      'Un mazo de control y paciencia. Los Entes reducen la fuerza enemiga hasta destruirla, recuperan cartas desde los Tributos y se materializan en formas superiores usando a sus aliados como material. Cada decisión sobre qué gastar define tus próximos turnos: premia al que planifica.',
    tags: ['Control', 'Recursos', 'Materialización'],
  },
  ST2: {
    color: 'Verde',
    tagline: 'Crece, hereda y arrasa.',
    philosophy:
      'Un mazo de poder puro. Tus Dragones evolucionan nivel a nivel heredando las habilidades de sus formas anteriores y destruyen enemigos al atacar, antes de que puedan bloquear. Concentra todo en un gran dragón y deja que su fuego decida la partida.',
    tags: ['Fuerza', 'Evolución', 'Destrucción'],
  },
  ST3: {
    color: 'Violeta',
    tagline: 'Toda pérdida alimenta la cacería.',
    philosophy:
      'Un mazo de sacrificio y presión. Las Bestias entregan a sus aliados para robar, invocar y volver a atacar; destruyen por nivel sin importar la fuerza del rival y encadenan cacerías que nunca dan respiro. Aquí cada caída es un recurso.',
    tags: ['Sacrificio', 'Cacería', 'Presión'],
  },
  ST4: {
    color: 'Rojo',
    tagline: 'Primero en cargar, último en caer.',
    philosophy:
      'Un mazo de velocidad y formación. Los Caballeros llegan al frente con Celeridad o invocados directamente a la vanguardia, se reactivan antes del bloqueo y atacan una y otra vez con aumentos de fuerza y Perforante. Gana quien golpea primero y más veces.',
    tags: ['Velocidad', 'Ataques múltiples', 'Formación'],
  },
};

export function structureStyle(editionId: string): StructureStyle | null {
  return STYLES[editionId.toUpperCase()] ?? null;
}

/** An edition's description as lore, unless it is still a placeholder ("rellenar"). */
export function structureLore(description: string | null | undefined): string | null {
  const text = description?.trim() ?? '';
  return text.length > 20 ? text : null;
}

/** The public deck that lists a structure deck's copies: the one named after it (ST1…), as the server reads it. */
export function structureDeck(decks: readonly Deck[], editionId: string): Deck | null {
  return decks.find((d) => d.deckName?.trim().toUpperCase() === editionId.toUpperCase()) ?? null;
}

/** A structure deck's cards, each once with its copies, in the deck's order. */
export function structureList(cardIds: readonly string[], catalog: readonly CatalogCard[]): { card: CatalogCard; copies: number }[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const out = new Map<string, { card: CatalogCard; copies: number }>();
  for (const id of cardIds) {
    const card = byId.get(id);
    if (!card) continue;
    const entry = out.get(id);
    if (entry) entry.copies++;
    else out.set(id, { card, copies: 1 });
  }
  return [...out.values()];
}
