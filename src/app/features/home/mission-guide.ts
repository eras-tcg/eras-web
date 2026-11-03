import { IconName } from '@ui/primitives/icon/icon.component';

/** What a section of the site is for, told to a player who arrives from a "Bienvenida" step. */
export interface MissionGuide {
  /** The section's name, as the dialog's title. */
  title: string;
  icon: IconName;
  intro: string;
  /** What can be done there, one line each. */
  points: string[];
  /** What completes the step. */
  goal: string;
}

const GUIDES: Record<string, MissionGuide> = {
  'how-to-play': {
    title: 'Cómo jugar',
    icon: 'book',
    intro: 'Aquí aprendes las reglas de ERAS paso a paso, con ejemplos que puedes probar.',
    points: [
      'Las gemas: cómo se generan y cómo se gastan para jugar cartas.',
      'El tapete: la mano, la vanguardia, la retaguardia y el resto de las zonas.',
      'Los ataques, las habilidades y cómo se encadenan los efectos.',
    ],
    goal: 'Recorre la guía para completar la misión.',
  },
  cards: {
    title: 'Cartas',
    icon: 'cards',
    intro: 'El catálogo con todas las cartas de ERAS, de todas las ediciones.',
    points: [
      'Busca por nombre y filtra por edición, color, tipo o rareza.',
      'Abre una carta para ver su arte en grande, su texto y sus efectos.',
      'Activa «Mostrar colección» para ver cuáles ya tienes y en qué acabado.',
    ],
    goal: 'Explora el catálogo para completar la misión.',
  },
  deck: {
    title: 'Constructor de mazos',
    icon: 'square-plus',
    intro: 'Aquí armas tus mazos con las cartas de tu colección.',
    points: [
      'Agrega cartas desde el catálogo de la izquierda; las que no tienes aparecen en gris.',
      'Usa los filtros para encontrar lo que buscas y revisa las copias de cada carta.',
      'Si te faltan cartas, puedes fabricarlas con fragmentos.',
    ],
    goal: 'Guarda tu primer mazo para completar la misión.',
  },
  pack: {
    title: 'Tienda',
    icon: 'box',
    intro: 'En la tienda gastas tus gemas en sobres, cajas y structure decks.',
    points: [
      'Elige una edición para ver sus sobres, sus probabilidades y las cartas que trae.',
      'Cada sobre se abre al momento y lo que obtienes va directo a tu colección.',
      'Con suerte te sale una carta foil, o incluso una prismática.',
    ],
    goal: 'Compra y abre tu primer sobre para completar la misión.',
  },
  avatar: {
    title: 'Tu perfil',
    icon: 'user',
    intro: 'Tu perfil es tu carta de presentación ante los demás jugadores.',
    points: ['Sube una imagen para tu ícono de jugador.', 'Revisa los datos de tu cuenta y cambia tu contraseña.'],
    goal: 'Sube una imagen de perfil para completar la misión.',
  },
};

/** The guide of the section a "Bienvenida" step leads to, or null when that step has none. */
export function missionGuide(stepId: string): MissionGuide | null {
  return GUIDES[stepId] ?? null;
}
