import { tablePlane } from './table-plane';

/**
 * The camera the table is seen with: its eye (the perspective's origin, on the screen) and how far it is. Cards that
 * fly between zones are drawn with this same camera, so near or far, left or right, they are seen as the table is
 * (one vanishing point for all: on the left they lean "/", on the right "\").
 */
export interface Stage {
  originX: number;
  originY: number;
  distance: number;
}

/**
 * Where a card is and how it is turned, in the table's 3D space: its center relative to the eye's point (x, y on the
 * screen's axes, z towards you), its own size, and its turns on each axis.
 */
export interface CardPose {
  x: number;
  y: number;
  z: number;
  /** Its own size (before any turn or scale). */
  width: number;
  height: number;
  /** Its 2D scale (none for most cards). */
  scale: number;
  /** Leaning back (X axis), in degrees: as the table on the table, none standing up (your hand). */
  lean: number;
  /** Turned on its own plane (Z axis), in degrees: exhausted (90), the rival's (180), a hand's fan. */
  turn: number;
}

/** The camera of the table now: the leaning table's, else a flat one centered on the screen. */
export function stageOf(document: Document): Stage {
  const plane = tablePlane(document);
  if (plane) return { originX: plane.origin.x, originY: plane.origin.y, distance: plane.distance };
  const view = document.defaultView;
  return { originX: (view?.innerWidth ?? 0) / 2, originY: (view?.innerHeight ?? 0) / 2, distance: 1000 };
}

/** The turn and scale an element's own 2D transforms give it (3D ones, the table's lean, are the pose's lean). */
function flatTurn(element: Element, stop: Element | null): { turn: number; scale: number } {
  const view = element.ownerDocument.defaultView;
  let turn = 0;
  let scale = 1;
  for (let el: Element | null = element; el && el !== stop && view; el = el.parentElement) {
    const t = view.getComputedStyle(el).transform;
    const m = t?.startsWith('matrix(') ? t.slice(7, -1).split(',').map(Number) : null;
    if (!m) continue;
    turn += (Math.atan2(m[1], m[0]) * 180) / Math.PI;
    scale *= Math.hypot(m[0], m[1]);
  }
  return { turn, scale };
}

/**
 * The pose an element is drawn in now. On the leaning table its point is found back on the table (undoing the
 * table's projection) and placed in 3D as the table places it; elsewhere (your hand, standing up) it is at the eye's
 * depth, where the screen shows it as it is. `size`: the card's own size there (else the element's). A card whose image
 * is shown upside down (the rival's) is turned half round.
 */
export function poseOf(element: HTMLElement, size?: { width: number; height: number }): CardPose {
  const rect = element.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const width = size?.width ?? element.offsetWidth;
  const height = size?.height ?? element.offsetHeight;
  const plane = tablePlane(element.ownerDocument);
  const onTable = !!plane?.holds(element);
  const flat = flatTurn(element, onTable ? element.closest('.plane') : null);
  const turn = flat.turn + (element.classList.contains('upside-down') ? 180 : 0);
  if (!plane || !onTable) {
    const stage = stageOf(element.ownerDocument);
    return { x: cx - stage.originX, y: cy - stage.originY, z: 0, width, height, scale: flat.scale, lean: 0, turn };
  }
  // The table turns about its origin by its lean: a point of it goes back (z < 0) as it goes up
  const at = plane.toLocal(cx, cy);
  const a = (plane.tilt * Math.PI) / 180;
  const dy = at.y - plane.originLocal.y;
  return {
    x: at.x - plane.originLocal.x,
    y: dy * Math.cos(a),
    z: dy * Math.sin(a),
    width,
    height,
    scale: flat.scale,
    lean: plane.tilt,
    turn,
  };
}

/** The transform that draws a card (placed at the stage's corner) in `pose`, seen by the stage's camera. */
function transformOf(stage: Stage, pose: CardPose, width: number, height: number, flip: number, scale: number): string {
  return (
    `translate3d(${stage.originX + pose.x - width / 2}px, ${stage.originY + pose.y - height / 2}px, ${pose.z}px) ` +
    `rotateX(${pose.lean}deg) rotateZ(${pose.turn}deg) rotateY(${flip}deg) scale(${scale})`
  );
}

/**
 * The keyframes of a card going from `from` to `to`, seen by `stage`'s camera: every axis turns at once, the shortest
 * way round on its own plane; halfway it rises off the table, towards you; face down at either end turns it over on
 * its Y axis. The card is drawn at `from`'s size; `under` lands it a little lower and smaller (a Material or Recurso
 * under a creature).
 */
export function poseFrames(stage: Stage, from: CardPose, to: CardPose, faces: { fromBack: boolean; toBack: boolean }, under = false): Keyframe[] {
  const w = from.width;
  const h = from.height;
  const turn = from.turn + ((((to.turn - from.turn) % 360) + 540) % 360) - 180;
  const a = (to.lean * Math.PI) / 180;
  // A Material or Recurso peeks out below its creature: a little towards you on the table
  const down = under ? to.height * 0.12 : 0;
  const end: CardPose = { ...to, turn, y: to.y + down * Math.cos(a), z: to.z + down * Math.sin(a) };
  const endScale = (to.scale * to.width * (under ? 0.85 : 1)) / w;
  const fromFlip = faces.fromBack ? 180 : 0;
  const toFlip = faces.toBack ? 180 : 0;
  // Halfway it rises off the table (along the table's up, between both leans), as much as the way is long
  const distance = Math.hypot(end.x - from.x, end.y - from.y, end.z - from.z);
  const lift = Math.min(90, distance * 0.25);
  const lean = (from.lean + end.lean) / 2;
  const b = (lean * Math.PI) / 180;
  const mid: CardPose = {
    ...end,
    x: (from.x + end.x) / 2,
    y: (from.y + end.y) / 2 - lift * Math.sin(b),
    z: (from.z + end.z) / 2 + lift * Math.cos(b),
    lean,
    turn: (from.turn + end.turn) / 2,
  };
  const midScale = (from.scale + endScale) / 2;
  return [
    { transform: transformOf(stage, from, w, h, fromFlip, from.scale), filter: 'drop-shadow(0 4px 6px rgb(0 0 0 / 35%))' },
    { transform: transformOf(stage, mid, w, h, (fromFlip + toFlip) / 2, midScale), filter: 'drop-shadow(0 16px 18px rgb(0 0 0 / 45%))', offset: 0.5 },
    { transform: transformOf(stage, end, w, h, toFlip, endScale), filter: 'drop-shadow(0 4px 6px rgb(0 0 0 / 35%))' },
  ];
}
