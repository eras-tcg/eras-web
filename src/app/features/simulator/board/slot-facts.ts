import { displayStrength } from '@data/simulator/game-rules';
import { CardSlot } from '@data/simulator/simulator.model';
import { CardFact } from '@ui/domain/card-facts/card-facts.component';

/**
 * A card of the game's facts for `eras-card-facts`: Nivel, Coste, Fuerza (as it is now on the field, marked when it
 * changed) and Clase. Empty for a card face down that the player may not see.
 */
export function slotFacts(s: CardSlot | null, { onField = false, visible = true }: { onField?: boolean; visible?: boolean } = {}): CardFact[] {
  if (!s || !visible) return [];
  const facts: CardFact[] = [];
  if (s.level != null) facts.push({ label: 'Nivel', value: String(s.level) });
  if (s.cost != null) facts.push({ label: 'Coste', value: String(s.cost) });
  if (s.strength != null) {
    const now = onField ? (displayStrength(s) ?? s.strength) : s.strength;
    facts.push({ label: 'Fuerza', value: String(now), changed: now !== s.strength });
  }
  if (s.classes?.length) facts.push({ label: 'Clase', value: s.classes.join(' · ') });
  return facts;
}
