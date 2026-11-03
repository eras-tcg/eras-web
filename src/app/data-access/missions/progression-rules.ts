import { Milestone, WelcomeStep } from '@core/missions/progression.model';

/** What a welcome step asks, in Spanish, and where it is done. */
export interface StepText {
  title: string;
  hint: string;
  route: string;
}

const STEPS: Record<string, StepText> = {
  welcome: { title: 'Bienvenido a ERAS', hint: 'Reclama tu regalo de bienvenida.', route: '/missions' },
  structure: { title: 'Elige tu structure deck', hint: 'Escoge un structure deck gratis para empezar a jugar.', route: '/missions' },
  'how-to-play': { title: 'Aprende a jugar', hint: 'Lee cómo se juega: gemas, ataques y cadenas de efectos.', route: '/ruling' },
  cards: { title: 'Conoce las cartas', hint: 'Explora el catálogo de cartas.', route: '/cards' },
  deck: { title: 'Arma tu mazo', hint: 'Guarda tu primer mazo en el constructor.', route: '/deck-builder' },
  pack: { title: 'Abre tu primer sobre', hint: 'Compra un sobre en la tienda de ediciones.', route: '/editions' },
  avatar: { title: 'Personaliza tu perfil', hint: 'Sube una imagen de perfil.', route: '/profile' },
  'first-game': { title: 'Tu primera partida', hint: 'Termina una partida online contra otro jugador.', route: '/play' },
  'first-win': { title: 'Primera victoria', hint: 'Gana una partida online.', route: '/play' },
  graduate: { title: 'Bienvenida completa', hint: 'Completa todos los pasos y gana la insignia Recluta.', route: '/missions' },
};

export function stepText(id: string): StepText {
  return STEPS[id] ?? { title: id, hint: '', route: '/missions' };
}

/** The step to do now: the first one not claimed (null once the chain is complete). */
export function currentStep(steps: readonly WelcomeStep[]): WelcomeStep | null {
  return steps.find((s) => !s.claimed) ?? null;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const MILESTONES: Record<string, { title: string; text: (n: number) => string }> = {
  games: { title: 'Veterano', text: (n) => `Juega ${n} ${plural(n, 'partida', 'partidas')}` },
  wins: { title: 'Campeón', text: (n) => `Gana ${n} ${plural(n, 'partida', 'partidas')}` },
  summons: { title: 'Invocador', text: (n) => `Invoca ${n} criaturas` },
  damage: { title: 'Destructor', text: (n) => `Inflige ${n.toLocaleString('es')} de daño` },
  'login-days': { title: 'Constante', text: (n) => `Entra al juego ${n} días` },
  collector: { title: 'Coleccionista', text: (n) => `Reúne ${n} cartas distintas` },
  packs: { title: 'Abresobres', text: (n) => `Abre ${n} sobres` },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** A milestone's name with its next tier ("Veterano II"; the last one once all are claimed). */
export function milestoneTitle(m: Pick<Milestone, 'id' | 'tier' | 'tiers'>): string {
  const title = MILESTONES[m.id]?.title ?? m.id;
  return `${title} ${ROMAN[Math.min(m.tier, m.tiers - 1)] ?? ''}`.trim();
}

/** What a milestone's next tier asks ("Juega 10 partidas"). */
export function milestoneText(m: Pick<Milestone, 'id' | 'target'>): string {
  return MILESTONES[m.id]?.text(m.target) ?? m.id;
}

/** The badges' names. */
export function badgeName(id: string): string {
  return id === 'recluta' ? 'Recluta' : id;
}
