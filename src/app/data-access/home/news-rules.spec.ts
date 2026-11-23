import { describe, expect, it } from 'vitest';
import { HomeNews } from './home.model';
import { allNews, latestNews } from './news-rules';

const n = (title: string, date: string): HomeNews => ({ title, date, excerpt: '', cardIds: [] });

describe('news rules', () => {
  it('joins the home news and the platform history, newest first, the home one winning a repeated title', () => {
    const home = [n('Llega E1.3', '2026-11-23T20:00'), n('Torneo', '2026-11-10T20:00')];
    const platform = [
      n('llega e1.3 ', '2026-11-22T10:00'),
      n('Ligas', '2026-11-15T10:00'),
      n('ERAS 2.0', '2026-10-27T10:00'),
    ];
    expect(allNews(home, platform).map((x) => x.title)).toEqual([
      'Llega E1.3',
      'Ligas',
      'Torneo',
      'ERAS 2.0',
    ]);
  });

  it('shows the latest five on the carousel', () => {
    const news = ['01', '05', '03', '07', '02', '06', '04'].map((d) => n(d, `2026-11-${d}T10:00`));
    expect(latestNews(news).map((x) => x.title)).toEqual(['07', '06', '05', '04', '03']);
  });
});
