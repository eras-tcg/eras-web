import { CardSpec, SpecNode } from './spec.model';

/** Groups of the template that are glossy as a whole (semi and full art cards only): the strength circle. */
const GLOSS_GROUPS = new Set(['strengthfigure']);
/**
 * Shapes that are always glossy: the colored type and name boxes (the name's is "left curved side" on cards with
 * inherited effects and some link cards), the special summon's requirement box and its cost circle.
 */
const GLOSS_SHAPES = new Set([
  'Type Frame',
  'br corner',
  'left curved side',
  'Special Summon Frame',
  'special cost',
  'special cost edge',
]);
/**
 * The colored strip along the top edge of utilities and structures (creatures have none): the card builder lays it
 * over the frames, named as in the prototypes and reaching above the card. A black piece of the same name inside a
 * frame (the semi full art one, under the tab) is not it.
 */
const isTopStrip = (n: SpecNode) => /^Rect.ngulo redondeado 4 copia/.test(n.name) && n.bbox[1] < 0;
/** The black frames and the gold border: no gloss, but the level's ring may live in them. */
const FRAME_GROUPS = new Set(['FRAME', 'GOLD BORDER']);
/** Whether a box holds a point. */
const holds = (b: number[], [x, y]: [number, number]) =>
  b[0] <= x && x <= b[2] && b[1] <= y && y <= b[3];

/** The middle of the level's number (where its badge is: bottom left, or higher on cards with inherited effects). */
function levelCenter(nodes: SpecNode[]): [number, number] | null {
  for (const n of nodes) {
    if (!n.visible) continue;
    if (n.name === 'LEVEL' && n.text)
      return [(n.bbox[0] + n.bbox[2]) / 2, (n.bbox[1] + n.bbox[3]) / 2];
    const hit = n.children ? levelCenter(n.children) : null;
    if (hit) return hit;
  }
  return null;
}

const WHITE = '#ffffff';
const BLACK = '#000000';
/** Texts over glossy parts that stay matte: the cost, special cost and strength numbers, the requirement, the name. */
const MATTE_TEXTS = new Set([
  'COST',
  'SPEC COST',
  'STRENGHT',
  'REQUIREMENT',
  'REQUIREMENT 2 LINES',
  'NAME',
]);

/** A shape painted solid white, its stroke too. */
const whiteShape = (n: SpecNode): SpecNode => ({
  ...n,
  opacity: 1,
  fillOpacity: 1,
  fill: WHITE,
  stroke: n.stroke ? { ...n.stroke, color: WHITE, gradient: null, opacity: 1 } : undefined,
  fx: undefined,
});

/** A ring: only its stroke, white (the badge inside stays out). */
const whiteRing = (n: SpecNode): SpecNode => ({
  ...n,
  opacity: 1,
  fill: null,
  stroke: { ...n.stroke!, color: WHITE, gradient: null, opacity: 1 },
  fx: undefined,
});

/** A text in white, its letters only. */
const whiteText = (n: SpecNode): SpecNode => ({
  ...n,
  opacity: 1,
  fx: undefined,
  text: { ...n.text!, runs: n.text!.runs.map((r) => ({ ...r, color: WHITE })) },
});

/** A text cut out of the mask: black letters (and black outline, so no shine is left around them). */
const blackText = (n: SpecNode): SpecNode => ({
  ...n,
  opacity: 1,
  fx: n.fx?.stroke
    ? { stroke: { ...n.fx.stroke, color: BLACK, gradient: null, opacity: 1 } }
    : undefined,
  text: { ...n.text!, runs: n.text!.runs.map((r) => ({ ...r, color: BLACK })) },
});

/**
 * The parts of a built card a glossy coat covers (cards of rarity R and above), as they are drawn on that card (its
 * template, frame style and colors): the type and name boxes, the colored strip along the top of utilities and
 * structures, the special summon's requirement box and its cost; on semi and full art cards also the strength, the
 * cost and the level (only its ring and its number). Never the black frame. The texts on them stay matte (cut out in
 * black): the cost, special cost and strength numbers, the requirement and the name. The result is a spec with only
 * those parts, white over nothing, the matte texts black: a luminance mask (it needs the card fonts).
 */
export function glossSpec(card: CardSpec & { style?: string }): CardSpec {
  const showcase = card.style === 'semi' || card.style === 'full';
  const level = levelCenter(card.layers);
  // The level's ring: a stroke-only circle around its number (the frames' or the gold border's)
  const isLevelRing = (n: SpecNode) =>
    !!level &&
    /^(circulo interior|Elipse)/.test(n.name) &&
    !!n.stroke &&
    !n.fill &&
    holds(n.bbox, level);
  const keep = (n: SpecNode, inside: boolean, inFrame: boolean): SpecNode | null => {
    if (!n.visible) return null;
    const frame = inFrame || FRAME_GROUPS.has(n.name);
    const glossy = !frame && (inside || (showcase && GLOSS_GROUPS.has(n.name)) || GLOSS_SHAPES.has(n.name));
    if (n.children) {
      const children = n.children
        .map((c) => keep(c, glossy, frame))
        .filter((c): c is SpecNode => !!c);
      return children.length ? { ...n, opacity: 1, fx: undefined, children } : null;
    }
    if (showcase && isLevelRing(n)) return whiteRing(n);
    if (showcase && n.name === 'LEVEL' && n.text) return whiteText(n);
    if (MATTE_TEXTS.has(n.name) && n.text) return blackText(n);
    if (frame || !n.paths?.length) return null;
    if (glossy || isTopStrip(n) || (showcase && n.name === 'COST FRAME')) return whiteShape(n);
    return null;
  };
  return {
    width: card.width,
    height: card.height,
    layers: card.layers.map((n) => keep(n, false, false)).filter((n): n is SpecNode => !!n),
  };
}

/** A fill that is black (a backing inside the gold border, under the type's label): not gold. */
const isBlack = (fill: SpecNode['fill']) => typeof fill === 'string' && /^#0{6}$/i.test(fill);

/**
 * The gold border of a card that has one (any rarity), as drawn on that card: its lines, corners and the ring around
 * the level, white (a filled piece solid, a stroke only as its line); a pixel piece as it is (its gold is bright); not
 * the black backing under the type's label nor its text. The card's name and its code are gold too (their letters,
 * white). Null when
 * the card has no gold border. A luminance mask for the border's metallic shine (it needs the card fonts).
 */
export function goldSpec(card: CardSpec): CardSpec | null {
  const hasGold = (nodes: SpecNode[]): boolean =>
    nodes.some((n) => n.visible && (n.name === 'GOLD BORDER' || (!!n.children && hasGold(n.children))));
  if (!hasGold(card.layers)) return null;
  const keep = (n: SpecNode, inGold: boolean): SpecNode | null => {
    if (!n.visible) return null;
    const gold = inGold || n.name === 'GOLD BORDER';
    if (n.children) {
      const children = n.children.map((c) => keep(c, gold)).filter((c): c is SpecNode => !!c);
      return children.length ? { ...n, opacity: 1, fx: undefined, children } : null;
    }
    if ((n.name === 'NAME' || n.name === 'EDITION') && n.text) return whiteText(n);
    if (!gold || n.text) return null;
    if (typeof n.raster === 'string') return { ...n, opacity: 1, fx: undefined };
    if (!n.paths?.length || isBlack(n.fill)) return null;
    return n.fill ? whiteShape(n) : n.stroke ? whiteRing(n) : null;
  };
  const layers = card.layers.map((n) => keep(n, false)).filter((n): n is SpecNode => !!n);
  return layers.length ? { width: card.width, height: card.height, layers } : null;
}

/** The effect box (its background, margin and the link card's): the foil leaves it clear, its text easy to read. */
const isEffectBox = (n: SpecNode) => /BACK EFFECT|EFFECT MARGIN|^LINK EFFECT/.test(n.name);

/**
 * What a foil (holographic or prismatic) leaves uncovered, as drawn on that card: the parts a glossy coat covers (glossSpec: the type
 * and name boxes, the requirement box and its cost, the top strip; the showcase parts on semi and full art cards),
 * whole, with their texts, on any card; the effect box; and the level's circle (its badge, ring and number). White over
 * nothing: the foil covers the rest of the card.
 */
export function foilCutSpec(card: CardSpec & { style?: string }): CardSpec {
  const level = levelCenter(card.layers);
  // The level's circle: the small shapes around its number (not the frames that hold it, as wide as the card)
  const isLevelPart = (n: SpecNode) =>
    !!level && holds(n.bbox, level) && n.bbox[2] - n.bbox[0] < card.width * 0.25;
  // The glossy parts whole: their matte texts (cut out of the gloss) are not holes here
  const solid = (n: SpecNode): SpecNode | null => {
    if (n.children) {
      const children = n.children.map(solid).filter((c): c is SpecNode => !!c);
      return children.length ? { ...n, children } : null;
    }
    return n.text && MATTE_TEXTS.has(n.name) ? null : n;
  };
  const effect = (n: SpecNode): SpecNode | null => {
    if (!n.visible) return null;
    if (n.children) {
      const children = n.children.map(effect).filter((c): c is SpecNode => !!c);
      return children.length ? { ...n, opacity: 1, fx: undefined, children } : null;
    }
    if (isLevelPart(n) && (n.paths?.length || n.text)) return n.text ? whiteText(n) : whiteShape(n);
    return isEffectBox(n) && n.paths?.length ? whiteShape(n) : null;
  };
  const layers = [
    ...glossSpec(card).layers.map(solid),
    ...card.layers.map(effect),
  ].filter((n): n is SpecNode => !!n);
  return { width: card.width, height: card.height, layers };
}
