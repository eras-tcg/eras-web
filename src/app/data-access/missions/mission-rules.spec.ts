import { claimable, missionText } from './mission-rules';

describe('mission rules', () => {
  it('says what each mission asks', () => {
    expect(missionText({ id: 'play', target: 3 })).toBe('Juega 3 partidas');
    expect(missionText({ id: 'win', target: 1 })).toBe('Gana 1 partida');
    expect(missionText({ id: 'login', target: 1 })).toBe('Entra al juego');
    expect(missionText({ id: 'login', target: 5 })).toBe('Entra al juego 5 días');
    expect(missionText({ id: 'special-summon', target: 5 })).toBe('Invoca 5 criaturas especialmente');
    expect(missionText({ id: 'damage', target: 500 })).toBe('Inflige 500 de daño');
  });

  it('can be claimed once done, and only once', () => {
    expect(claimable({ id: 'win', progress: 1, target: 1, gems: 100, claimed: false })).toBe(true);
    expect(claimable({ id: 'win', progress: 0, target: 1, gems: 100, claimed: false })).toBe(false);
    expect(claimable({ id: 'win', progress: 1, target: 1, gems: 100, claimed: true })).toBe(false);
  });
});
