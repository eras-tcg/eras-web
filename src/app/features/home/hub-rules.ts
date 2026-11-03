import type { IconName } from '@ui/primitives/icon/icon.component';
import { WelcomeStep } from '@core/missions/progression.model';
import { stepClaimable } from '@core/missions/progression.store';
import { Edition } from '@data/editions/edition.model';
import { currentStep, stepText } from '@data/missions/progression-rules';
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
  | { kind: 'news'; news: NewsItem; image: string | null };

/** Carousel of the hub: featured edition, then each news item with the artwork of its edition when known. */
export function hubSlides(edition: Edition | null, news: NewsItem[], editions: Edition[] = []): HubSlide[] {
  const slides: HubSlide[] = [];
  if (edition) slides.push({ kind: 'edition', edition });
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
  /** Opened as a dialog instead of following the route: the greeting or the structure deck picker. */
  flow?: 'welcome' | 'structure';
  /** A "Bienvenida" step whose section opens with its guide (MissionGuideFlow). */
  guide?: string;
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

/**
 * The step of the "Bienvenida" missions to do now, while the chain is not complete (null once it is, or while
 * unknown): to the missions to claim it when it is done, else to where it is done.
 */
export function welcomeNextStep(steps: readonly WelcomeStep[] | null): NextStep | null {
  const step = steps ? currentStep(steps) : null;
  if (!step) return null;
  const text = stepText(step.id);
  const claim = stepClaimable(step);
  const next: NextStep = { title: text.title, text: text.hint, action: claim ? 'Reclamar' : 'Ir', route: claim ? '/missions' : text.route, icon: 'target' };
  if (step.id === 'welcome') return { ...next, action: 'Abrir', flow: 'welcome' };
  if (step.id === 'structure' && step.gems === 0) return { ...next, action: 'Elegir', flow: 'structure' };
  return claim ? next : { ...next, guide: step.id };
}
