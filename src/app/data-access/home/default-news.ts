import { HomeNews } from './home.model';

/** The carousel's news until an administrator saves the first ones (the first save keeps these, as edited). */
export const DEFAULT_NEWS: HomeNews[] = [
  {
    date: '2026-11-04T20:00',
    title: 'Llega ERAS 2.0',
    excerpt:
      'La nueva versión de la web abre sus puertas: inicio renovado, tienda con sobres y cajas, colección con fragmentos y misiones diarias y semanales.',
    cardIds: [],
  },
  {
    date: '2026-11-05T20:00',
    title: 'El comienzo del fin de los tiempos',
    excerpt: 'La primera edición llega a la tienda. Abre sus sobres y empieza a armar tu colección desde el principio.',
    cardIds: [],
  },
  {
    date: '2026-11-06T20:00',
    title: 'Enfrentamientos Interdimensionales',
    excerpt: 'Segunda parada de la semana: los sobres y cajas de E1.1 ya están disponibles en la tienda.',
    cardIds: [],
  },
  {
    date: '2026-11-07T20:00',
    title: 'Ocaso Del Mundo Conocido',
    excerpt: 'E1.2 se suma a la tienda. Busca sus cartas foil y prismáticas en cada apertura.',
    cardIds: [],
  },
  {
    date: '2026-11-08T20:00',
    title: 'Compromiso Y Evolución',
    excerpt: 'Cerramos la semana con E1.3: las cuatro primeras ediciones quedan disponibles para abrir, romper y fabricar.',
    cardIds: [],
  },
];

/** "mié 4 nov" (the news' day as the carousel shows it, no hour); the text itself when it is not a date. */
export function newsDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' }).format(date).replace(/[.,]/g, '');
}
