export interface NewsItem {
  date: string;
  dateLabel: string;
  title: string;
  excerpt: string;
  /** Edition whose artwork illustrates the item, if any. */
  editionId?: string;
}

/** Static placeholder content until there is a news backend. */
export const NEWS: NewsItem[] = [
  {
    date: '2026-11-04T20:00',
    dateLabel: 'mié 4 nov · 20:00',
    title: 'Llega ERAS 2.0',
    excerpt:
      'La nueva versión de la web abre sus puertas: inicio renovado, tienda con sobres y cajas, colección con fragmentos y misiones diarias y semanales.',
    editionId: 'E2',
  },
  {
    date: '2026-11-05T20:00',
    dateLabel: 'jue 5 nov · 20:00',
    title: 'El comienzo del fin de los tiempos',
    excerpt: 'La primera edición llega a la tienda. Abre sus sobres y empieza a armar tu colección desde el principio.',
    editionId: 'E1',
  },
  {
    date: '2026-11-06T20:00',
    dateLabel: 'vie 6 nov · 20:00',
    title: 'Enfrentamientos Interdimensionales',
    excerpt: 'Segunda parada de la semana: los sobres y cajas de E1.1 ya están disponibles en la tienda.',
    editionId: 'E1.1',
  },
  {
    date: '2026-11-07T20:00',
    dateLabel: 'sáb 7 nov · 20:00',
    title: 'Ocaso Del Mundo Conocido',
    excerpt: 'E1.2 se suma a la tienda. Busca sus cartas foil y prismáticas en cada apertura.',
    editionId: 'E1.2',
  },
  {
    date: '2026-11-08T20:00',
    dateLabel: 'dom 8 nov · 20:00',
    title: 'Compromiso Y Evolución',
    excerpt: 'Cerramos la semana con E1.3: las cuatro primeras ediciones quedan disponibles para abrir, romper y fabricar.',
    editionId: 'E1.3',
  },
];
