import { Mission } from './mission.model';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** What a mission asks, in Spanish, with its target ("Juega 3 partidas"). */
export function missionText(mission: Pick<Mission, 'id' | 'target'>): string {
  const n = mission.target;
  switch (mission.id) {
    case 'login':
      return n === 1 ? 'Entra al juego' : `Entra al juego ${n} días`;
    case 'play':
      return `Juega ${n} ${plural(n, 'partida', 'partidas')}`;
    case 'win':
      return `Gana ${n} ${plural(n, 'partida', 'partidas')}`;
    case 'summon':
      return `Invoca ${n} ${plural(n, 'criatura', 'criaturas')}`;
    case 'effect-summon':
      return `Invoca ${n} ${plural(n, 'criatura', 'criaturas')} por efecto`;
    case 'special-summon':
      return `Invoca ${n} ${plural(n, 'criatura', 'criaturas')} especialmente`;
    case 'damage':
      return `Inflige ${n} de daño`;
    default:
      return mission.id;
  }
}

/** Done and not yet claimed: its gems wait. */
export function claimable(mission: Mission): boolean {
  return !mission.claimed && mission.progress >= mission.target;
}
