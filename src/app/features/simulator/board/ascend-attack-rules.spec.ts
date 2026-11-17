import { CardSlot, EffectPrompt } from '@data/simulator/simulator.model';
import { ascendAttackAnswer, ascendAttackCreatures } from './ascend-attack-rules';

describe('ascend attack (Príncipe Charles)', () => {
  const card = (instanceId: string) => ({ instanceId }) as CardSlot;
  const prompt = {
    validIds: ['ch', 'e1'],
    cards: [card('ch'), card('e1'), card('e2')],
  } as unknown as EffectPrompt;

  it('shows the enemy creatures it can attack, not the summoner', () => {
    expect(ascendAttackCreatures(prompt, 'ch').map((c) => c.instanceId)).toEqual(['e1']);
  });

  it('answers the creature, the summoner for the rival, or nothing to ascend without attacking', () => {
    expect(ascendAttackAnswer('e1', 'ch')).toEqual(['e1']);
    expect(ascendAttackAnswer(null, 'ch')).toEqual(['ch']);
    expect(ascendAttackAnswer(undefined, 'ch')).toEqual([]);
  });
});
