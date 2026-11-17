import { CardSlot, EffectPrompt } from '@data/simulator/simulator.model';

/**
 * "cuando esta carta fuera a ser ascendida: puede declarar ataque" (Príncipe Charles), shown as the regular attack chooser: the enemy
 * creatures it can attack are the prompt's options other than the summoner (the engine lists the summoner itself for the rival).
 */
export function ascendAttackCreatures(prompt: EffectPrompt, summonerId: string): CardSlot[] {
  return prompt.cards.filter((c) => c.instanceId !== summonerId && prompt.validIds.includes(c.instanceId));
}

/**
 * The answer to the engine for what the chooser closed with: a creature id attacks it, null (the rival) answers the summoner itself,
 * undefined ("No atacar", or closed) answers nothing: it is ascended without attacking.
 */
export function ascendAttackAnswer(target: string | null | undefined, summonerId: string): string[] {
  if (target === undefined) return [];
  return [target ?? summonerId];
}
