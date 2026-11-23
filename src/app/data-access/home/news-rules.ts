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
