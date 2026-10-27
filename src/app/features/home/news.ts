export interface NewsItem {
  date: string;
  dateLabel: string;
  title: string;
  excerpt: string;
}

/** Static until there is a news backend (same content as the Vue home). */
export const NEWS: NewsItem[] = [
  {
    date: '2026-03-11',
    dateLabel: '11 mar 2026',
    title: 'Primera edición',
    excerpt:
      'También está disponible la primera edición, por favor siéntase libre de crear mazos y compartirlos con el resto, su motivación es nuestra motivación.',
  },
  {
    date: '2026-03-11',
    dateLabel: '11 mar 2026',
    title: 'Estructuras',
    excerpt:
      'Los mazos de estructura ya están disponibles, puedes verlos en la barra de navegación en la sección de Mazos, también puedes crear los tuyos propios si te registras.',
  },
  {
    date: '2026-03-11',
    dateLabel: '11 mar 2026',
    title: '¡Por fin página nueva!',
    excerpt:
      'Primera noticia del sistema, aún sin contenido pero con ganas de llenarla de cosas interesantes. Ninguna de las noticias es accesible en profundidad (dicho menú está en desarrollo).',
  },
];
