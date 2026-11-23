import { describe, expect, it } from 'vitest';
import { HomeNews } from './home.model';
import { allNews, announcedEdition, latestNews, linkedEdition, newsBody } from './news-rules';

const n = (title: string, date: string, over: Partial<HomeNews> = {}): HomeNews => ({
  title,
  date,
  excerpt: '',
  cardIds: [],
  ...over,
});

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

  it('reads the edition a site link leads to', () => {
    expect(linkedEdition('/cards/editions/E1.3')).toBe('E1.3');
    expect(linkedEdition('/cards?edition=E1.3')).toBe('E1.3');
    expect(linkedEdition('/editions/E1.3')).toBe('E1.3');
    expect(linkedEdition('/cards?edition=E1&color=R')).toBeNull();
    expect(linkedEdition('/deck-builder')).toBeNull();
  });

  it('tells an edition announcement from a news item proper', () => {
    expect(
      announcedEdition(n('Cualquiera', '2026-11-01', { linkRoute: '/cards?edition=E1.2' })),
    ).toBe('E1.2');
    // a saved default news item without its link keeps the default's
    expect(announcedEdition(n('Compromiso Y Evolución', '2026-11-08'))).toBe('E1.3');
    // a home news item with no link whose title names an edition announces it; the platform's history never does
    expect(announcedEdition(n('Llega E1.3: El Ciclo del Caos', '2026-11-23'))).toBe('E1.3');
    expect(
      announcedEdition(n('E1.3 en el simulador', '2026-11-22', { id: 'platform-x' })),
    ).toBeNull();
    expect(announcedEdition(n('Llega ERAS 2.0', '2026-11-04'))).toBeNull();
    expect(announcedEdition(n('Misiones', '2026-11-02', { linkRoute: '/missions' }))).toBeNull();
  });

  it('tells a news item in full: its body, a default one of the same title, or its excerpt', () => {
    expect(newsBody(n('n', '2026-11-01', { excerpt: 'corto', body: 'largo' }))).toBe('largo');
    expect(newsBody(n('Llega ERAS 2.0', '2026-11-04'))).toContain('ERAS estrena');
    expect(newsBody(n('Otra', '2026-11-01', { excerpt: 'corto' }))).toBe('corto');
  });
});
