import type { IconName } from '@ui/primitives/icon/icon.component';
import { Deck } from '@data/decks/deck.model';
import { Edition } from '@data/editions/edition.model';
import { NewsItem } from './news';

/**
 * Background of the home hub: a random edition with artwork, never the one shown last time when there is
 * another to choose. `random` returns [0, 1) like Math.random.
 */
export function pickBackground(editions: Edition[], previousId: string | null, random: () => number = Math.random): Edition | null {
  const withArt = editions.filter((e) => !!e.editionImage);
  const pool = withArt.length > 1 ? withArt.filter((e) => e.editionId !== previousId) : withArt;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export type HubSlide =
  | { kind: 'edition'; edition: Edition }
  | { kind: 'decks'; decks: Deck[] }
  | { kind: 'news'; news: NewsItem; image: string | null };

/**
 * Carousel of the hub: featured edition, then the featured decks (one slide), then each news item with the artwork
 * of its edition when that edition is among `editions`.
 */
export function hubSlides(edition: Edition | null, decks: (Deck | null)[], news: NewsItem[], editions: Edition[] = []): HubSlide[] {
  const slides: HubSlide[] = [];
  if (edition) slides.push({ kind: 'edition', edition });
  const featured = decks.filter((d): d is Deck => d !== null);
  if (featured.length > 0) slides.push({ kind: 'decks', decks: featured });
  const art = new Map(editions.map((e) => [e.editionId, e.editionImage ?? null]));
  for (const item of news) slides.push({ kind: 'news', news: item, image: (item.editionId && art.get(item.editionId)) || null });
  return slides;
}

export interface NextStep {
  title: string;
  text: string;
  action: string;
  route: string;
  icon: IconName;
}

const FIRST_DECK: NextStep = {
  title: 'Crea tu primer mazo',
  text: 'Arma un mazo con las cartas que más te gusten para empezar a jugar.',
  action: 'Ir al constructor',
  route: '/deck-builder',
  icon: 'square-plus',
};

/** Suggestions for players who already have decks; one per day, in turn. */
const SUGGESTIONS: NextStep[] = [
  {
    title: 'Pon a prueba tus mazos',
    text: 'Abre una sala en el simulador y juega una partida.',
    action: 'Jugar',
    route: '/simulator',
    icon: 'gamepad',
  },
  {
    title: 'Repasa las reglas',
    text: 'Gemas, ataques y cadenas de efectos explicados paso a paso.',
    action: 'Cómo jugar',
    route: '/ruling',
    icon: 'book',
  },
  {
    title: 'Mira la tierlist',
    text: 'Descubre qué cartas están marcando el formato.',
    action: 'Ver tierlist',
    route: '/tierlist',
    icon: 'trophy',
  },
  {
    title: 'Inspírate en otros mazos',
    text: 'Revisa los mazos que comparte la comunidad.',
    action: 'Mazos públicos',
    route: '/public-decks',
    icon: 'stack',
  },
];

/**
 * What the hub suggests doing next. `myDecks` is null while unknown (no suggestion yet).
 * `day` is any whole number that changes once a day (e.g. days since the epoch).
 */
export function nextStep(myDecks: number | null, day: number): NextStep | null {
  if (myDecks === null) return null;
  if (myDecks === 0) return FIRST_DECK;
  return SUGGESTIONS[((day % SUGGESTIONS.length) + SUGGESTIONS.length) % SUGGESTIONS.length];
}
