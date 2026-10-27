import { CardEffect, EffectBlock } from './card.model';

export const emptyBlock = (): EffectBlock => ({ activationCondition: '', cost: '', resolution: '' });

export const emptyEffect = (): CardEffect => ({ instance: null, ussageLimit: null, kind: null, tags: [], effectBlocks: [emptyBlock()] });

/** One-line text of an effect, as the backend's Effect.getPlainEffect() builds it. */
export function effectSummary(effect: CardEffect | null | undefined): string {
  if (!effect) return '';
  let text = '';
  if (effect.instance) text += `<${effect.instance}> `;
  if (effect.ussageLimit === 'once per turn') text += '[once per turn] ';
  if (effect.ussageLimit === 'once per turn between copies') text += '(1) ';
  for (const block of effect.effectBlocks ?? []) {
    if (block.activationCondition) text += `${block.activationCondition}: `;
    if (block.cost) text += `${block.cost}; `;
    if (block.resolution) text += `${block.resolution} `;
  }
  return text.trim();
}

/** Drops empty blocks and trims text, keeping at least one block. */
export function cleanEffect(effect: CardEffect): CardEffect {
  const blocks = (effect.effectBlocks ?? [])
    .map((b) => ({ activationCondition: b.activationCondition?.trim() ?? '', cost: b.cost?.trim() ?? '', resolution: b.resolution?.trim() ?? '' }))
    .filter((b) => b.activationCondition || b.cost || b.resolution);
  return {
    instance: effect.instance || null,
    ussageLimit: effect.ussageLimit || null,
    kind: effect.kind || null,
    tags: [...(effect.tags ?? [])],
    effectBlocks: blocks.length ? blocks : [emptyBlock()],
  };
}

/**
 * Keyword with a parameter: "@" in the name and in the effect text marks where the value goes,
 * and becomes "{name}" (e.g. "Provocar @" + "nivel" → "Provocar {nivel}").
 */
export function applyPlaceholder(keyword: string, effect: CardEffect, placeholder: string): { keyword: string; effect: CardEffect } {
  const name = placeholder.trim();
  if (!name) return { keyword: keyword.trim(), effect };
  const fill = (s: string | null | undefined) => (s == null ? s : s.replace(/@/g, `{${name}}`));
  return {
    keyword: fill(keyword.trim()) ?? '',
    effect: {
      ...effect,
      instance: fill(effect.instance) ?? null,
      effectBlocks: (effect.effectBlocks ?? []).map((b) => ({
        activationCondition: fill(b.activationCondition),
        cost: fill(b.cost),
        resolution: fill(b.resolution),
      })),
    },
  };
}
