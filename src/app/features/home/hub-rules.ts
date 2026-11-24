import type { IconName } from '@ui/primitives/icon/icon.component';
import { WelcomeStep } from '@core/missions/progression.model';
import { stepClaimable } from '@core/missions/progression.store';
import { Edition } from '@data/editions/edition.model';
import { currentStep, stepText } from '@data/missions/progression-rules';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl, fullEditionId } from '@data/cards/card-rules';
import { HomeNews } from '@data/home/home.model';
import { newsDateLabel } from '@data/home/default-news';
import { announcedEdition, editionPage, newsBody } from '@data/home/news-rules';

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

/** A card shown whole on a slide. */
export interface SlideCard {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** What every slide shows: its text on one side and up to three whole cards on the other. */
interface SlideBase {
  key: string;
  /** "Edición destacada" or the news' day, "mié 4 nov". */
  eyebrow: string;
  /** ISO date of a news item, for its <time>. */
  date: string | null;
  title: string;
  text: string;
  cards: SlideCard[];
}

/** An edition (the featured one, or a news item announcing one): its three rarest cards; a click goes to its page. */
export interface EditionSlide extends SlideBase {
  kind: 'edition';
  link: string;
}

/**
 * A news item proper: its cards when it has any (else the vortex with the gem); a click opens it in full, with its
 * button when it has one.
 */
export interface NewsSlide extends SlideBase {
  kind: 'news';
  /** The news told in full, for its pop-up. */
  body: string;
  action: { label: string; url: string } | null;
}

/** A slide of the hub's carousel, and a row of the news log. */
export type HubSlide = EditionSlide | NewsSlide;

const RARITY_RANK: Record<string, number> = { GOD: 6, SEC: 5, SR: 4, R: 3, UC: 2, C: 1 };

/** The three rarest cards of an edition with an image (then by number): an edition's showcase. */
export function editionShowcase(editionId: string, cards: readonly CatalogCard[]): CatalogCard[] {
  return cards
    .filter((c) => fullEditionId(c) === editionId && !!cardImageUrl(c))
    .sort(
      (a, b) =>
        (RARITY_RANK[b.meta?.rarity ?? ''] ?? 0) - (RARITY_RANK[a.meta?.rarity ?? ''] ?? 0) ||
        (a.number ?? 0) - (b.number ?? 0),
    )
    .slice(0, 3);
}

const view = (c: CatalogCard): SlideCard => ({
  id: c.id,
  name: c.meta?.cardName ?? c.name ?? '',
  imageUrl: cardImageUrl(c),
});

/** The featured edition: its name and description, its showcase. */
function editionSlide(edition: Edition, cards: readonly CatalogCard[]): EditionSlide {
  return {
    key: `edition-${edition.editionId}`,
    kind: 'edition',
    eyebrow: 'Edición destacada',
    date: null,
    title: edition.editionName || edition.editionId,
    text: edition.editionDescription ?? '',
    cards: editionShowcase(edition.editionId, cards).map(view),
    link: editionPage(edition.editionId),
  };
}

/** A news item: an edition's announcement (its cards, else the edition's showcase) or a news item proper. */
function newsSlide(
  item: HomeNews,
  index: number,
  cards: readonly CatalogCard[],
  byId: Map<string, CatalogCard>,
): HubSlide {
  const own = item.cardIds.map((id) => byId.get(id)).filter((c): c is CatalogCard => !!c);
  const base = {
    key: item.id ?? `news-${index}`,
    eyebrow: newsDateLabel(item.date),
    date: item.date,
    title: item.title,
    text: item.excerpt,
  };
  const edition = announcedEdition(item);
  if (edition)
    return {
      ...base,
      kind: 'edition',
      cards: (own.length ? own : editionShowcase(edition, cards)).map(view),
      link: editionPage(edition),
    };
  return {
    ...base,
    kind: 'news',
    cards: own.map(view),
    body: newsBody(item),
    action: item.linkRoute ? { label: item.linkLabel || 'Ver más', url: item.linkRoute } : null,
  };
}

/** The hub's carousel (and the news log): the featured edition, then each news item. */
export function hubSlides(
  edition: Edition | null,
  news: readonly HomeNews[],
  cards: readonly CatalogCard[] = [],
): HubSlide[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return [
    ...(edition ? [editionSlide(edition, cards)] : []),
    ...news.map((item, i) => newsSlide(item, i, cards, byId)),
  ];
}

/** A month of the news log and its slides, in the order given (newest first). */
export interface SlideMonth {
  label: string;
  items: HubSlide[];
}

/** The news log's slides by month ("noviembre de 2026"); one without a date goes under "Sin fecha". */
export function slidesByMonth(slides: readonly HubSlide[]): SlideMonth[] {
  const months: SlideMonth[] = [];
  for (const slide of slides) {
    const date = new Date(slide.date ?? '');
    const label = Number.isNaN(date.getTime())
      ? 'Sin fecha'
      : new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(date);
    const last = months.at(-1);
    if (last?.label === label) last.items.push(slide);
    else months.push({ label, items: [slide] });
  }
  return months;
}

export interface NextStep {
  title: string;
  text: string;
  action: string;
  route: string;
  icon: IconName;
  /** Opened as a dialog instead of following the route: the greeting or the structure deck picker. */
  flow?: 'structure';
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
  if (step.id === 'structure' && !claim) return { ...next, action: 'Elegir', flow: 'structure' };
  return claim ? next : { ...next, guide: step.id };
}
