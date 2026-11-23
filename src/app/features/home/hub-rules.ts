import type { IconName } from '@ui/primitives/icon/icon.component';
import { WelcomeStep } from '@core/missions/progression.model';
import { stepClaimable } from '@core/missions/progression.store';
import { Edition } from '@data/editions/edition.model';
import { currentStep, stepText } from '@data/missions/progression-rules';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl, fullEditionId } from '@data/cards/card-rules';
import { HomeNews } from '@data/home/home.model';
import { DEFAULT_NEWS, newsDateLabel } from '@data/home/default-news';

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

/** A slide of the hub's carousel: its text on one side and up to three whole cards on the other. */
export interface HubSlide {
  key: string;
  /** The featured edition (a click goes to its page) or a news item (a click opens it). */
  kind: 'edition' | 'news';
  /** "Edición destacada" or the news' day, "mié 4 nov". */
  eyebrow: string;
  /** ISO date of a news item, for its <time>. */
  date: string | null;
  title: string;
  text: string;
  /** The news told in full, for its pop-up (the excerpt when it has none). */
  body: string;
  /** Where a click on the slide leads (the edition's page); null: a news item, it opens in full. */
  link: string | null;
  cards: SlideCard[];
  /** Its button: where it leads (a site URL) and its text. */
  action: { label: string; url: string } | null;
}

const RARITY_RANK: Record<string, number> = { GOD: 6, SEC: 5, SR: 4, R: 3, UC: 2, C: 1 };

/** The three rarest cards of an edition with an image (then by number): the featured edition's showcase. */
export function editionShowcase(editionId: string, cards: readonly CatalogCard[]): CatalogCard[] {
  return cards
    .filter((c) => fullEditionId(c) === editionId && !!cardImageUrl(c))
    .sort((a, b) => (RARITY_RANK[b.meta?.rarity ?? ''] ?? 0) - (RARITY_RANK[a.meta?.rarity ?? ''] ?? 0) || (a.number ?? 0) - (b.number ?? 0))
    .slice(0, 3);
}

/**
 * An edition's page (in Ediciones, "/cards/editions/E1.3"): where a link to its cards ("/cards?edition=E1.3") or to its
 * shop ("/editions/E1.3") leads instead; other links as they are.
 */
export function editionLink(url: string): string {
  const match = /^\/cards\?edition=([^&#]+)$/.exec(url) ?? /^\/editions\/([^/?#]+)$/.exec(url);
  return match ? `/cards/editions/${match[1]}` : url;
}

/**
 * The page of the edition a home news item's title names ("Llega E1.3: …" → /cards/editions/E1.3), or null; never for
 * the platform's history (its titles mention editions without announcing them: "E1.3 en el simulador").
 */
function namedEdition(item: HomeNews): string | null {
  if (item.id?.startsWith('platform-')) return null;
  const match = /\b(E\d+(?:\.\d+)*)\b/.exec(item.title);
  return match ? `/cards/editions/${match[1]}` : null;
}

/** Carousel of the hub: the featured edition (its rarest cards), then each news item with its cards. */
export function hubSlides(edition: Edition | null, news: readonly HomeNews[], cards: readonly CatalogCard[] = []): HubSlide[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const view = (c: CatalogCard): SlideCard => ({ id: c.id, name: c.meta?.cardName ?? c.name ?? '', imageUrl: cardImageUrl(c) });
  const slides: HubSlide[] = [];
  if (edition) {
    slides.push({
      key: `edition-${edition.editionId}`,
      kind: 'edition',
      eyebrow: 'Edición destacada',
      date: null,
      title: edition.editionName || edition.editionId,
      text: edition.editionDescription ?? '',
      body: edition.editionDescription ?? '',
      link: `/cards/editions/${encodeURIComponent(edition.editionId)}`,
      cards: editionShowcase(edition.editionId, cards).map(view),
      action: null,
    });
  }
  news.forEach((item, i) => {
    // An edition's announcement works as the featured edition: a click goes to the edition's page, no pop-up, no
    // button. It is one when its link leads to an edition (its own link, or the default news' of the same title) or,
    // a news item of the home with no link, when its title names an edition ("Llega E1.3: El Ciclo del Caos")
    const route = item.linkRoute || DEFAULT_NEWS.find((d) => d.title === item.title)?.linkRoute || namedEdition(item) || null;
    const url = route ? editionLink(route) : null;
    const edition = url?.startsWith('/cards/editions/') ? url : null;
    slides.push({
      key: item.id ?? `news-${i}`,
      kind: 'news',
      eyebrow: newsDateLabel(item.date),
      date: item.date,
      title: item.title,
      text: item.excerpt,
      body: item.body || DEFAULT_NEWS.find((d) => d.title === item.title)?.body || item.excerpt,
      link: edition,
      cards: item.cardIds.map((id) => byId.get(id)).filter((c): c is CatalogCard => !!c).map(view),
      action: url && !edition ? { label: item.linkLabel || 'Ver más', url } : null,
    });
  });
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
