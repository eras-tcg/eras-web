/**
 * "Mesa en perspectiva" for the board's animations. The table's plane leans back with a 3D transform; what animates
 * over it (a card flying, a ring of light, an arrow, an attacker charging) is drawn apart, in screen coordinates, and
 * would stay flat. A layer that copies the plane's transform (the same matrix, origin and box) leans whatever is put in
 * it exactly as the table: positions in it are the plane's own, found by undoing the projection of a point on the
 * screen. Your hand and the players' plates stand up facing you: they are not on the plane.
 */
export interface TablePlane {
  /** The table leans (wide screens with "Mesa en perspectiva" on). */
  readonly tilt: number;
  /** A layer leaning as the table, at `zIndex` (a number or a `--z-sim-*` token); remove it when done. */
  layer(zIndex: number | string): HTMLElement;
  /** The point of the plane drawn at this point of the screen, in the plane's own pixels. */
  toLocal(x: number, y: number): { x: number; y: number };
  /** Where a point of the plane (its own pixels) is drawn on the screen. */
  toScreen(x: number, y: number): { x: number; y: number };
  /** How far the eye is from the table (its perspective), in pixels. */
  readonly distance: number;
  /** Where the eye looks from (the plane's perspective origin): on the screen, and in the plane's own pixels. */
  readonly origin: { x: number; y: number };
  readonly originLocal: { x: number; y: number };
  /** The element lies on the table (a field card, a pile), not standing up (your hand, a plate). */
  holds(element: Element | null): boolean;
}

/** Where a point of the plane goes: its 3D matrix read as a 2D homography (the plane is at z = 0). */
type Homography = [number, number, number, number, number, number, number, number, number];

function invert(h: Homography): Homography | null {
  const [a, b, c, d, e, f, g, i, j] = h;
  const det = a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g);
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    (e * j - f * i) * k, (c * i - b * j) * k, (b * f - c * e) * k,
    (f * g - d * j) * k, (a * j - c * g) * k, (c * d - a * f) * k,
    (d * i - e * g) * k, (b * g - a * i) * k, (a * e - b * d) * k,
  ];
}

/** A point of a plane leaning by `matrix` (about `origin`, its box at `box`) and the screen, both ways; null if it is edge-on. */
/** The coefficients of a 3D matrix that a plane at z = 0 uses (as DOMMatrix names them). */
export type PlaneMatrix = Pick<DOMMatrixReadOnly, 'm11' | 'm12' | 'm14' | 'm21' | 'm22' | 'm24' | 'm41' | 'm42' | 'm44'>;

export function projection(matrix: PlaneMatrix, origin: { x: number; y: number }, box: { left: number; top: number }) {
  // (x - ox, y - oy, 0, 1) → (X, Y, ·, W): screen = box + origin + (X, Y) / W
  const forward: Homography = [matrix.m11, matrix.m21, matrix.m41, matrix.m12, matrix.m22, matrix.m42, matrix.m14, matrix.m24, matrix.m44];
  const back = invert(forward);
  if (!back) return null;
  const apply = (h: Homography, x: number, y: number) => {
    const w = h[6] * x + h[7] * y + h[8];
    return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
  };
  return {
    toScreen(x: number, y: number) {
      const p = apply(forward, x - origin.x, y - origin.y);
      return { x: box.left + origin.x + p.x, y: box.top + origin.y + p.y };
    },
    toLocal(x: number, y: number) {
      const p = apply(back, x - box.left - origin.x, y - box.top - origin.y);
      return { x: p.x + origin.x, y: p.y + origin.y };
    },
  };
}

/** The leaning table's plane in this document, or null when the table is flat (nothing to do). */
export function tablePlane(document: Document): TablePlane | null {
  const plane = document.querySelector<HTMLElement>('.table.tilted .plane');
  const table = plane?.parentElement;
  const view = document.defaultView;
  if (!plane || !table || !view) return null;
  const style = view.getComputedStyle(plane);
  if (!style.transform || style.transform === 'none') return null;
  const matrix = new DOMMatrix(style.transform);
  const [ox, oy] = style.transformOrigin.split(' ').map((v) => parseFloat(v) || 0);
  // The plane's box before it leans: its place in the table (which does not lean)
  const t = table.getBoundingClientRect();
  const box = { left: t.left + plane.offsetLeft, top: t.top + plane.offsetTop, width: plane.offsetWidth, height: plane.offsetHeight };
  const project = projection(matrix, { x: ox, y: oy }, box);
  if (!project) return null;
  const tableStyle = view.getComputedStyle(table);
  const tilt = parseFloat(tableStyle.getPropertyValue('--tilt')) || 0;
  const distance = (parseFloat(tableStyle.getPropertyValue('--depth')) || 2.2) * table.clientHeight;
  return {
    tilt,
    distance,
    toScreen: project.toScreen,
    origin: { x: box.left + ox, y: box.top + oy },
    originLocal: { x: ox, y: oy },
    layer(zIndex: number | string): HTMLElement {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'fixed',
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        transform: style.transform,
        transformOrigin: style.transformOrigin,
        transformStyle: 'preserve-3d',
        pointerEvents: 'none',
        zIndex: String(zIndex),
      });
      document.body.append(el);
      return el;
    },
    toLocal: project.toLocal,
    holds(element: Element | null): boolean {
      if (!element || !element.closest('.table.tilted .plane')) return false;
      return !element.closest('eras-player-half:not(.opponent) .hand') && !element.closest('eras-player-plate');
    },
  };
}

/** A place to draw an animation over the board: on the leaning table, or flat on the screen. */
export interface Overlay {
  /** Where it is drawn: append to it (the screen's body, or a layer leaning as the table). */
  readonly host: HTMLElement;
  /** How its elements are placed in the host. */
  readonly position: 'absolute' | 'fixed';
  /** A point of the screen, in the host's own pixels. */
  at(x: number, y: number): { x: number; y: number };
  /** Removes the layer (nothing for the screen's body; its elements are removed by whoever added them). */
  remove(): void;
}

/**
 * Where to draw an animation over `element`: on the leaning table when the table leans and the element lies on it
 * (`always`: whenever it leans), else flat on the screen.
 */
export function overlayFor(document: Document, element: Element | null, zIndex: string, always = false): Overlay {
  const plane = tablePlane(document);
  if (plane && (always || plane.holds(element))) {
    const host = plane.layer(zIndex);
    return { host, position: 'absolute', at: (x, y) => plane.toLocal(x, y), remove: () => host.remove() };
  }
  return { host: document.body, position: 'fixed', at: (x, y) => ({ x, y }), remove: () => undefined };
}
