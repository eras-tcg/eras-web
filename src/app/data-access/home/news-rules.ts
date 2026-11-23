import { DEFAULT_NEWS } from './default-news';
import { HomeNews } from './home.model';

/** How many news items the home's carousel shows: the latest; every one is in the news log (the bar's bell). */
export const CAROUSEL_NEWS = 5;

/**
 * Every news item of the platform, newest first: the home's (saved by its administrators, or the defaults) and the
 * platform's history (PLATFORM_NEWS); one of the home's wins over a history item of the same title.
 */
export function allNews(home: readonly HomeNews[], platform: readonly HomeNews[]): HomeNews[] {
  const titles = new Set(home.map((n) => n.title.trim().toLowerCase()));
  return [...home, ...platform.filter((n) => !titles.has(n.title.trim().toLowerCase()))].sort(
    (a, b) => b.date.localeCompare(a.date),
  );
}

/** The carousel's news: the latest CAROUSEL_NEWS of them. */
export function latestNews(news: readonly HomeNews[], count = CAROUSEL_NEWS): HomeNews[] {
  return [...news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
}

/** An edition's page, in Ediciones. */
export function editionPage(editionId: string): string {
  return `/cards/editions/${encodeURIComponent(editionId)}`;
}

/** The edition a site link leads to: its page ("/cards/editions/E1.3"), its cards ("/cards?edition=E1.3") or its shop ("/editions/E1.3"). */
export function linkedEdition(url: string | null | undefined): string | null {
  const match =
    /^\/cards\/editions\/([^/?#]+)$/.exec(url ?? '') ??
    /^\/cards\?edition=([^&#]+)$/.exec(url ?? '') ??
    /^\/editions\/([^/?#]+)$/.exec(url ?? '');
  return match ? decodeURIComponent(match[1]) : null;
}

/** The default news item of the same title (a saved copy of it keeps what it lacks: its link, its full text). */
function defaultOf(item: HomeNews): HomeNews | undefined {
  return DEFAULT_NEWS.find((d) => d.title === item.title);
}

/**
 * The edition a news item announces, or null for a news item proper: the edition its link leads to (or its default's
 * link) or, for a news item of the home without a link, the one its title names ("Llega E1.3: …"); the platform's
 * history never announces by title (its titles mention editions without announcing them: "E1.3 en el simulador").
 */
export function announcedEdition(item: HomeNews): string | null {
  const link = item.linkRoute || defaultOf(item)?.linkRoute;
  if (link) return linkedEdition(link);
  if (item.id?.startsWith('platform-')) return null;
  return /\b(E\d+(?:\.\d+)*)\b/.exec(item.title)?.[1] ?? null;
}

/** A news item told in full: its own text, its default's, or its excerpt. */
export function newsBody(item: HomeNews): string {
  return item.body || defaultOf(item)?.body || item.excerpt;
}
