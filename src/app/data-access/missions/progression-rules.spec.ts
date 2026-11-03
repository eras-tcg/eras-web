import { describe, expect, it } from 'vitest';
import { WelcomeStep } from '@core/missions/progression.model';
import { milestoneClaimable, stepClaimable } from '@core/missions/progression.store';
import { currentStep, milestoneText, milestoneTitle, stepText } from './progression-rules';

const step = (id: string, over: Partial<WelcomeStep> = {}): WelcomeStep => ({ id, progress: 0, target: 1, gems: 100, claimed: false, locked: false, ...over });

describe('progression rules', () => {
  it('says what each welcome step asks and where it is done', () => {
    expect(stepText('how-to-play')).toEqual(expect.objectContaining({ title: 'Aprende a jugar', route: '/ruling' }));
    expect(stepText('deck').route).toBe('/deck-builder');
    expect(stepText('unknown').title).toBe('unknown');
  });

  it('claims a step only when open, not claimed and done; the structure step by choosing the deck', () => {
    expect(stepClaimable(step('deck', { progress: 1 }))).toBe(true);
    expect(stepClaimable(step('deck'))).toBe(false);
    expect(stepClaimable(step('deck', { progress: 1, locked: true }))).toBe(false);
    expect(stepClaimable(step('deck', { progress: 1, claimed: true }))).toBe(false);
    expect(stepClaimable(step('structure'))).toBe(true);
  });

  it('the step to do now is the first one not claimed', () => {
    expect(currentStep([step('welcome', { claimed: true }), step('structure'), step('cards', { locked: true })])?.id).toBe('structure');
    expect(currentStep([step('welcome', { claimed: true })])).toBeNull();
  });

  it('names a milestone by its next tier and says what it asks', () => {
    expect(milestoneTitle({ id: 'games', tier: 1, tiers: 5 })).toBe('Veterano II');
    expect(milestoneTitle({ id: 'games', tier: 5, tiers: 5 })).toBe('Veterano V');
    expect(milestoneText({ id: 'wins', target: 1 })).toBe('Gana 1 partida');
    expect(milestoneText({ id: 'collector', target: 150 })).toBe('Reúne 150 cartas distintas');
  });

  it('a milestone waits to be claimed when its tier is done and it is not complete', () => {
    const m = { id: 'games', tier: 1, tiers: 5, progress: 10, target: 10, gems: 250, maxed: false };
    expect(milestoneClaimable(m)).toBe(true);
    expect(milestoneClaimable({ ...m, progress: 9 })).toBe(false);
    expect(milestoneClaimable({ ...m, maxed: true })).toBe(false);
  });
});
