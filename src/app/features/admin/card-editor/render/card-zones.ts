import { BuiltCard, Measure, textSpan } from './card-build';
import { SpecNode } from './spec.model';

/** What a click on the card edits. */
export type ZoneKey =
  | 'cost'
  | 'strength'
  | 'level'
  | 'name'
  | 'classes'
  | 'code'
  | 'rarity'
  | 'regulation'
  | 'specialAdd'
  | 'specialCost'
  | 'specialKind'
  | 'requirement'
  | 'specialRemove'
  | 'effects'
  | 'inheritEffects'
  | 'formationEffects';

/** A clickable area of the card, in card pixels [x0, y0, x1, y1]. */
export interface Zone {
  key: ZoneKey;
  rect: [number, number, number, number];
}

/** First node with this name whose whole branch is shown. */
export function findShown(nodes: SpecNode[], name: string): SpecNode | null {
  for (const n of nodes) {
    if (!n.visible) continue;
    if (n.name === name) return n;
    const hit = n.children ? findShown(n.children, name) : null;
    if (hit) return hit;
  }
  return null;
}

/** First node with this name, shown or not (template geometry). */
function findAny(nodes: SpecNode[], name: string): SpecNode | null {
  for (const n of nodes) {
    if (n.name === name) return n;
    const hit = n.children ? findAny(n.children, name) : null;
    if (hit) return hit;
  }
  return null;
}

const FONT = (size: number) => `700 ${size}px "ERAS Book Antiqua"`;

/** Top and bottom of a text line in card pixels (box texts hang from their top, point texts sit on a baseline). */
function textRows(n: SpecNode): [number, number] {
  const t = n.text!;
  const [, , , yy, , ty] = t.transform;
  const size = (t.runs[0]?.size ?? 12) * yy;
  return t.box ? [ty, ty + size * 1.05] : [ty - size * 0.78, ty + size * 0.22];
}

/** Square around a point text's center (cost, strength, level, special cost). */
function around(n: SpecNode, w: number, up: number, down: number): Zone['rect'] {
  const [, , , , tx, ty] = n.text!.transform;
  return [tx - w, ty - up, tx + w, ty + down];
}

/** The clickable areas of a built card. */
export function cardZones(card: BuiltCard, measure: Measure): Zone[] {
  const zones: Zone[] = [];
  const L = card.layers;
  const shown = (name: string) => findShown(L, name);
  const add = (key: ZoneKey, rect: Zone['rect'] | null) => {
    if (rect) zones.push({ key, rect });
  };

  const cost = findAny(L, 'COST');
  if (cost?.text) add('cost', around(cost, 34, 56, 22));
  const strength = findAny(L, 'STRENGHT');
  if (card.card.cardType === 'creature' && strength?.text)
    add('strength', around(strength, 38, 56, 22));
  const level = findAny(L, 'LEVEL');
  if (level?.text) add('level', around(level, 44, 58, 32));

  const name = findAny(L, 'NAME');
  if (name?.text) {
    const [top, bottom] = textRows(name);
    add('name', [118, top - 14, 700, bottom + 12]);
  }

  const type = findAny(L, 'TYPE');
  const ed = shown('EDITION') ?? findAny(L, 'EDITION');
  const badge = shown('REGULATION BG') ?? shown('Rectángulo redondeado 4');
  let codeLeft = 600;
  if (ed?.text) {
    const span = textSpan(ed, measure);
    const [top, bottom] = textRows(ed);
    const rarity = card.card.rarity || '';
    const size = (ed.text.runs[0]?.size ?? 12) * ed.text.transform[3];
    const rarityW = rarity
      ? measure(` ${rarity}`, FONT(size)) * (ed.text.transform[0] / ed.text.transform[3])
      : 0;
    const codeEnd = span[1] - rarityW;
    codeLeft = span[0];
    add('code', [span[0] - 4, top - 6, codeEnd, bottom + 6]);
    // With no rarity yet, a small slot right of the code still opens the list.
    add(
      'rarity',
      rarity
        ? [codeEnd, top - 6, span[1] + 3, bottom + 6]
        : [span[1] - 2, top - 6, span[1] + 14, bottom + 6],
    );
    const regX = badge ? badge.bbox[0] : span[1] + 8;
    add(
      'regulation',
      badge
        ? [badge.bbox[0] - 2, badge.bbox[1] - 2, badge.bbox[2] + 2, badge.bbox[3] + 2]
        : [regX, top - 6, regX + 24, bottom + 6],
    );
  }
  if (type?.text) {
    const [top, bottom] = textRows(type);
    add('classes', [130, top - 2, codeLeft - 8, bottom + 2]);
  }

  // Special summon: its parts when the card has one, else an add button over its box.
  const frame = findAny(L, 'Special Summon Frame');
  const kind = card.card.specialSummonKind;
  if (frame) {
    const [fx0, fy0, fx1, fy1] = frame.bbox;
    if (!kind) {
      if (card.card.cardType === 'creature')
        add('specialAdd', [fx0 + 140, fy0 + 14, fx1 - 140, fy1 - 14]);
    } else {
      const sc = findAny(L, 'SPEC COST');
      if (sc?.text) add('specialCost', around(sc, 32, 44, 22));
      const req = shown('REQUIREMENT 2 LINES') ?? shown('REQUIREMENT');
      if (req?.text) {
        const [, , , yy, tx] = req.text.transform;
        const size = (req.text.runs[0]?.size ?? 12) * yy;
        const [top] = textRows(req);
        const word = req.text.text.split(/[\r:]/)[0] + ':';
        const w = measure(word, FONT(size));
        add('specialKind', [tx - 3, top - 4, tx + w + 3, top + size * 1.1]);
        add('requirement', [tx + w + 3, fy0 + 4, fx1 - 70, fy1 - 4]);
      }
      add('specialRemove', [fx1 - 30, fy0 - 26, fx1, fy0 - 2]);
    }
  }

  // Effect boxes go first (under the small areas) and stop where the next area below begins.
  const effects: Zone[] = card.effectSlots.map((slot) => ({
    key:
      slot.name === 'INHERIT EFFECT'
        ? 'inheritEffects'
        : slot.name === 'EFFECT copia' && card.card.enlace
          ? 'formationEffects'
          : 'effects',
    rect: [
      slot.box.x - 4,
      slot.box.y - 4,
      slot.box.x + slot.box.w + 4,
      slot.box.y + slot.box.h + 4,
    ],
  }));
  const tops = [...zones.map((z) => z.rect[1]), ...effects.map((z) => z.rect[1])];
  for (const z of effects) {
    const below = tops.filter((y) => y > z.rect[1] + 20);
    if (below.length) z.rect[3] = Math.min(z.rect[3], Math.min(...below) - 4);
  }
  zones.unshift(...effects);
  return zones;
}
