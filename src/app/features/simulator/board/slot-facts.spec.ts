import { CardSlot } from '@data/simulator/simulator.model';
import { slotFacts } from './slot-facts';

describe('slotFacts', () => {
  const slot = { level: 2, cost: 1, strength: 3, strengthModifier: 2, classes: ['Paladín', 'Blanco'] } as unknown as CardSlot;

  it('lists level, cost, strength and classes in that order', () => {
    expect(slotFacts(slot)).toEqual([
      { label: 'Nivel', value: '2' },
      { label: 'Coste', value: '1' },
      { label: 'Fuerza', value: '3', changed: false },
      { label: 'Clase', value: 'Paladín · Blanco' },
    ]);
  });

  it('on the field: the strength as it is now, marked when it changed', () => {
    expect(slotFacts(slot, { onField: true })[2]).toEqual({ label: 'Fuerza', value: '5', changed: true });
  });

  it('nothing for a card that cannot be seen', () => {
    expect(slotFacts(slot, { visible: false })).toEqual([]);
    expect(slotFacts(null)).toEqual([]);
  });
});
