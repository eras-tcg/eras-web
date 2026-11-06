import { BoardAnimations } from './board-animations';
import { Seen, TableMeasure } from './card-seen';
import { TablePlane, tablePlane } from './table-plane';
import { LAYER, TIMING } from './timing';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * The cards' own motions on the table: a destroyed card breaking where it lies, a field card gliding to its new line
 * or in from where it was summoned, and the burst of light where a summoned card lands.
 */
export class CardMotions {
  constructor(
    private readonly document: Document,
    private readonly animations: BoardAnimations,
    private readonly measure: TableMeasure,
    /** Runs an animation now, or once what plays ends. */
    private readonly run: (fn: () => void) => void,
    /** Something started playing with this update: the motions wait for it, held where they start. */
    private readonly deferring: () => boolean,
  ) {}

  /** A destroyed card cracks where it was: it shakes, a red flash and a burst of shards. */
  shatter(from: Seen): void {
    const lying = this.onPlane(from);
    const at = lying?.at ?? from;
    const box = this.document.createElement('div');
    Object.assign(box.style, {
      position: lying ? 'absolute' : 'fixed',
      left: `${at.x - from.width / 2}px`,
      top: `${at.y - from.height / 2}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      zIndex: LAYER.shatter,
      pointerEvents: 'none',
      borderRadius: '6px',
      transform: from.tapped || from.rival ? `rotate(${(from.tapped ? 90 : 0) + (from.rival ? 180 : 0)}deg)` : '',
    });
    if (from.imageUrl) {
      Object.assign(box.style, { backgroundImage: `url("${from.imageUrl}")`, backgroundSize: 'cover' });
    } else {
      box.style.background = 'var(--color-card-back)';
    }
    // Cracks drawn over it
    const cracks = this.document.createElementNS(SVG, 'svg');
    cracks.setAttribute('viewBox', '0 0 63 88');
    Object.assign(cracks.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    cracks.innerHTML =
      '<path d="M31 40 L20 8 M31 40 L48 14 M31 40 L58 46 M31 40 L44 80 M31 40 L14 70 M31 40 L4 36 M20 8 L12 2 M48 14 L56 6 M44 80 L50 87" ' +
      'stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" style="filter: drop-shadow(0 0 2px var(--color-sim-rival))"/>';
    box.append(cracks);
    (lying?.layer ?? this.document.body).append(box);
    this.animations.hold(TIMING.shatter);
    cracks.animate([{ opacity: 0 }, { opacity: 1 }], { duration: TIMING.shatter * 0.4, fill: 'both' });
    const turn = box.style.transform;
    const animation = box.animate(
      [
        { transform: `${turn} translateX(0)`, filter: 'none' },
        { transform: `${turn} translateX(-4px)`, filter: 'brightness(1.4) drop-shadow(0 0 12px var(--color-sim-rival))', offset: 0.25 },
        { transform: `${turn} translateX(4px)`, filter: 'brightness(1.6) drop-shadow(0 0 18px var(--color-sim-rival))', offset: 0.5 },
        { transform: `${turn} translateX(-2px) scale(1.04)`, filter: 'brightness(2) drop-shadow(0 0 24px var(--color-sim-rival))', opacity: 1, offset: 0.8 },
        { transform: `${turn} scale(1.1)`, filter: 'brightness(2.5) blur(2px)', opacity: 0 },
      ],
      { duration: TIMING.shatter, easing: 'ease-in' },
    );
    const gone = () => (lying?.layer ?? box).remove();
    animation.onfinish = gone;
    animation.oncancel = gone;
  }

  /**
   * The real card travels from where it was to where it is now (it is put back there and let go): straight for a
   * summon, in an arc (rising a little, then down) for a change of line.
   */
  glide(box: HTMLElement, card: HTMLElement, from: Seen, duration: number, arc: boolean): void {
    if (this.animations.still()) return;
    const rect = card.getBoundingClientRect();
    let dx = from.x - (rect.left + rect.width / 2);
    let dy = from.y - (rect.top + rect.height / 2);
    // On the leaning table it moves on the plane: the distance in its own pixels, not the screen's
    const plane = tablePlane(this.document);
    if (plane?.holds(card)) {
      const a = plane.toLocal(from.x, from.y);
      const b = plane.toLocal(rect.left + rect.width / 2, rect.top + rect.height / 2);
      dx = a.x - b.x;
      dy = a.y - b.y;
    }
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    const scale = card.offsetWidth ? from.width / card.offsetWidth : 1;
    const lift = Math.min(40, Math.hypot(dx, dy) * 0.25);
    const frames: Keyframe[] = arc
      ? [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, filter: 'drop-shadow(0 0 0 transparent)' },
          { transform: `translate(${dx / 2}px, ${dy / 2 - lift}px) scale(${scale * 1.08})`, filter: 'drop-shadow(0 14px 18px rgb(0 0 0 / 55%))', offset: 0.5 },
          { transform: 'translate(0, 0) scale(1)', filter: 'drop-shadow(0 0 0 transparent)' },
        ]
      : [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          { transform: 'translate(0, 0) scale(1.06)', offset: 0.85 },
          { transform: 'translate(0, 0) scale(1)' },
        ];
    // Above its neighbours while it travels; held where it was while something else plays
    box.style.position ||= 'relative';
    box.style.zIndex = LAYER.raised;
    if (this.deferring()) box.style.transform = String(frames[0]['transform']);
    this.run(() => {
      box.style.transform = '';
      this.animations.hold(duration);
      const animation = box.animate(frames, { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
      const done = () => (box.style.zIndex = '');
      animation.onfinish = done;
      animation.oncancel = done;
    });
  }

  /**
   * A summoned card lands: a ring of light opens from it and a glow fades on it (cyan yours, pink the rival's).
   * `landing`: where the card lies once landed (not where it travels from).
   */
  burst(card: HTMLElement, landing: DOMRect, mine: boolean, delay: number): void {
    if (this.animations.still()) return;
    this.run(() => this.burstNow(card, landing, mine, delay));
  }

  private burstNow(card: HTMLElement, rect: DOMRect, mine: boolean, delay: number): void {
    const color = mine ? 'var(--color-sim-link-mine)' : 'var(--color-sim-link-rival)';
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    // On the leaning table the ring lies on it, around the card at its own size
    const lying = this.onPlane({ ...center, width: 0, height: 0, tapped: false, imageUrl: null, plane: this.measure.onTable(card) });
    const size = lying ? Math.max(card.offsetWidth, card.offsetHeight) * 1.6 : Math.max(rect.width, rect.height) * 1.6;
    const at = lying?.at ?? center;
    const ring = this.document.createElement('div');
    Object.assign(ring.style, {
      position: lying ? 'absolute' : 'fixed',
      left: `${at.x - size / 2}px`,
      top: `${at.y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      border: `3px solid ${color}`,
      boxShadow: `0 0 24px 6px ${color}, inset 0 0 24px 4px ${color}`,
      zIndex: LAYER.flight,
      pointerEvents: 'none',
      opacity: '0',
    });
    (lying?.layer ?? this.document.body).append(ring);
    this.animations.hold(delay + TIMING.burst);
    const animation = ring.animate(
      [
        { opacity: 0.95, transform: 'scale(0.35)' },
        { opacity: 0, transform: 'scale(1.15)' },
      ],
      { duration: TIMING.burst, delay, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    );
    const gone = () => (lying?.layer ?? ring).remove();
    animation.onfinish = gone;
    animation.oncancel = gone;
    card.animate(
      [
        { boxShadow: `0 0 0 3px #fff, 0 0 40px 14px ${color}` },
        { boxShadow: '0 0 0 0 transparent, 0 0 0 0 transparent' },
      ],
      { duration: TIMING.burst, delay, easing: 'ease-out' },
    );
  }

  /**
   * A layer over the table for an animation at `from`: leaning as the table when it lies on it, with the point in the
   * layer's own pixels; else none (the screen, flat). Remove the layer when done.
   */
  private onPlane(from: Seen): { plane: TablePlane; layer: HTMLElement; at: { x: number; y: number } } | null {
    const plane = from.plane ? tablePlane(this.document) : null;
    if (!plane) return null;
    return { plane, layer: plane.layer(LAYER.flight), at: plane.toLocal(from.x, from.y) };
  }
}
