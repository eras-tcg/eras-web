import { HomeNews } from './home.model';

/** The carousel's news until an administrator saves the first ones (the first save keeps these, as edited). */
export const DEFAULT_NEWS: HomeNews[] = [
  {
    date: '2026-11-04T20:00',
    title: 'Llega ERAS 2.0',
    excerpt:
      'La nueva versión de la web abre sus puertas: inicio renovado, tienda con sobres y cajas, colección con fragmentos y misiones diarias y semanales.',
    body:
      'ERAS estrena una web nueva de punta a punta.\n\n' +
      'El inicio reúne en una sola pantalla lo que necesitas: las noticias, tu siguiente paso y el acceso directo a jugar, a tus mazos y a tu colección.\n\n' +
      'En la tienda abres sobres y cajas de cada edición con las gemas que ganas jugando. Lo que abres va a tu colección, donde ves qué te falta de cada edición; las copias que no necesitas se rompen en fragmentos, y con fragmentos fabricas las cartas que buscas.\n\n' +
      'Las misiones diarias y semanales te dan gemas por jugar, armar mazos y probar cosas nuevas. Y si es tu primera vez, la Bienvenida te guía paso a paso.',
    cardIds: [],
  },
  {
    date: '2026-11-05T20:00',
    title: 'El comienzo del fin de los tiempos',
    excerpt: 'La primera edición llega a la tienda. Abre sus sobres y empieza a armar tu colección desde el principio.',
    body:
      'La primera edición de ERAS ya está en la tienda.\n\n' +
      'El comienzo del fin de los tiempos es el punto de partida del juego: sus cartas son la base de las demás ediciones y de los mazos de estructura.\n\n' +
      'Abre sus sobres y cajas, revisa en tu colección las cartas que te faltan y arma tu primer mazo con ellas. Cada apertura suma a tu colección desde el principio.',
    linkRoute: '/cards/editions/E1',
    linkLabel: 'Ver edición',
    cardIds: [],
  },
  {
    date: '2026-11-06T20:00',
    title: 'Enfrentamientos Interdimensionales',
    excerpt: 'Segunda parada de la semana: los sobres y cajas de E1.1 ya están disponibles en la tienda.',
    body:
      'Segunda parada de la semana: Enfrentamientos Interdimensionales (E1.1) llega a la tienda.\n\n' +
      'Sus sobres y cajas ya se pueden abrir con tus gemas. Sus cartas amplían lo que ofrece la primera edición y abren nuevas formas de armar tus mazos.\n\n' +
      'Revisa la edición para ver todas sus cartas y suma las que te interesen a tu colección.',
    linkRoute: '/cards/editions/E1.1',
    linkLabel: 'Ver edición',
    cardIds: [],
  },
  {
    date: '2026-11-07T20:00',
    title: 'Ocaso Del Mundo Conocido',
    excerpt: 'E1.2 se suma a la tienda. Busca sus cartas foil y prismáticas en cada apertura.',
    body:
      'Ocaso del Mundo Conocido (E1.2) se suma a la tienda.\n\n' +
      'Además de sus cartas normales, en cada apertura puedes encontrar versiones foil y prismáticas: la misma carta con un acabado especial que brilla al moverla.\n\n' +
      'Las copias foil y prismáticas cuentan para tu colección como cualquier otra, y se muestran con su brillo en tus mazos y en la mesa.',
    linkRoute: '/cards/editions/E1.2',
    linkLabel: 'Ver edición',
    cardIds: [],
  },
  {
    date: '2026-11-08T20:00',
    title: 'Compromiso Y Evolución',
    excerpt: 'Cerramos la semana con E1.3: las cuatro primeras ediciones quedan disponibles para abrir, romper y fabricar.',
    body:
      'Cerramos la semana con Compromiso y Evolución (E1.3).\n\n' +
      'Con ella, las cuatro primeras ediciones quedan disponibles en la tienda. Ya puedes abrir sobres y cajas de cualquiera de ellas, romper las copias que te sobran en fragmentos y fabricar las cartas que te faltan.\n\n' +
      'Es un buen momento para completar tu colección y armar mazos que combinen cartas de las cuatro ediciones.',
    linkRoute: '/cards/editions/E1.3',
    linkLabel: 'Ver edición',
    cardIds: [],
  },
];

/** "mié 4 nov" (the news' day as the carousel shows it, no hour); the text itself when it is not a date. */
export function newsDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' }).format(date).replace(/[.,]/g, '');
}
