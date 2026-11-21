import { Injectable, signal } from '@angular/core';
import { ZoneName } from '@data/simulator/simulator.model';
import { tablePlane } from './table-plane';

export interface DraggedCard {
  instanceId: string;
  fromZone: ZoneName;
  /** One of your creatures that can attack now: dropped on an enemy creature, the rival's lives or hand, it attacks. */
  attack?: boolean;
}

const DRAG_TYPE = 'application/x-eras-slot';

/**
 * How a held card moves in the hand, in degrees: it leans back as the table does (none on a flat table), and swings
 * with the hand's speed (per pixel moved): it turns on its vertical axis and sways on its plane as it is carried
 * sideways, and tips as it is carried up or down; at most. Still, it settles back.
 */
const SWING_PER_PX = 1.4;
const MAX_SWING = 28;
const SWAY_PER_PX = 0.45;
const MAX_SWAY = 10;
const TIP_PER_PX = 0.8;
const MAX_TIP = 16;
/** How fast the swing follows the hand (0–1 per pointer event): it eases in and settles back. */
const SWING_EASE = 0.3;
/** The eye's distance for a held card's turns, in pixels. */
const HELD_PERSPECTIVE = 900;
/** What the table draws over a card that is not the card (strength, counts, its information, marks). */
const MARKS = '.strength, .badge, .info-cost, .info-type, .info-classes, .info-level, eras-chain-marks, .combat-badge';
const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

/** An image the browser draws for a drag: nothing (the card itself is held instead). */
const NO_IMAGE = (() => {
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  return img;
})();

/**
 * Card being dragged on the board (one per board page). The card itself is held: a copy of it, as big as it is and sharp, follows
 * the pointer from where it was grabbed (leaning a little with the hand's movement), while its place is left empty;
 * not the browser's faded picture of it.
 */
@Injectable()
export class BoardDrag {
  readonly dragging = signal<DraggedCard | null>(null);

  /** The card in the hand: its copy, the card left behind, where it was grabbed and the last pointer x. */
  private held: {
    copy: HTMLElement;
    source: HTMLElement;
    dx: number;
    dy: number;
    lastX: number;
    lastY: number;
    /** Leaning back, and the swing now (eased towards the hand's). */
    back: number;
    swing: number;
    sway: number;
    tip: number;
  } | null = null;
  private readonly follow = (e: DragEvent) => this.move(e.clientX, e.clientY);
  // Dropped anywhere, or the drag ended (also when its card was taken off the page meanwhile): the hand is empty
  private readonly dropped = () => this.letGo();
  // The drag is over (also when its card left the page meanwhile and its own dragend never comes): nothing is held
  private readonly ended = () => this.end();

  start(event: DragEvent, card: DraggedCard): void {
    this.dragging.set(card);
    event.dataTransfer?.setData(DRAG_TYPE, JSON.stringify(card));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.hold(event);
  }

  end(): void {
    this.dragging.set(null);
    this.letGo();
  }

  /** The card picked up: its copy in the hand (the browser draws none), its place left empty. */
  private hold(event: DragEvent): void {
    this.letGo();
    const source = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!source || !event.dataTransfer || !NO_IMAGE) return;
    event.dataTransfer.setDragImage(NO_IMAGE, 0, 0);
    const rect = source.getBoundingClientRect();
    const copy = source.cloneNode(true) as HTMLElement;
    // Only the card is picked up: what the table draws over it (strength, counts, marks, glows) stays behind
    copy.querySelectorAll(MARKS).forEach((m) => m.remove());
    copy.classList.remove('selected', 'can-play', 'can-activate', 'targeted', 'source', 'attack-target', 'combat-attacker', 'combat-defender', 'prompt-chosen', 'new-card');
    // Grabbed at the same spot of the card, as big as it is (scaling its picture would blur it)
    const dx = event.clientX - rect.left;
    const dy = event.clientY - rect.top;
    Object.assign(copy.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      zIndex: 'var(--z-sim-drag)',
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      pointerEvents: 'none',
      transition: 'none',
      transformOrigin: `${dx}px ${dy}px`,
      outline: 'none',
      animation: 'none',
      // A plain shadow: a filter would turn the card into a picture the browser then stretches (blurred)
      boxShadow: '0 18px 30px rgb(0 0 0 / 55%)',
    });
    const table = tablePlane(source.ownerDocument);
    const back = table && table.tilt > 0 ? table.tilt : 0;
    this.held = { copy, source, dx, dy, lastX: event.clientX, lastY: event.clientY, back, swing: 0, sway: 0, tip: 0 };
    this.move(event.clientX, event.clientY);
    source.ownerDocument.addEventListener('dragover', this.follow, true);
    source.ownerDocument.addEventListener('drop', this.dropped, true);
    source.ownerDocument.addEventListener('dragend', this.ended, true);
    // The page changes only once the browser has taken the drag: changing it during dragstart makes Chrome end the drag
    // at once (the card could not be dropped). Then the copy is in the hand and the card's place empties
    setTimeout(() => {
      if (this.held?.copy !== copy) return;
      source.ownerDocument.body.appendChild(copy);
      source.style.opacity = '0';
    });
  }

  /** The held card under the pointer, from where it was grabbed, leaning with the hand's sideways speed. */
  private move(x: number, y: number): void {
    const h = this.held;
    // Some browsers send a last (0, 0) when the drag ends
    if (!h || (x === 0 && y === 0)) return;
    const vx = x - h.lastX;
    const vy = y - h.lastY;
    h.lastX = x;
    h.lastY = y;
    // The browser repeats the last position while the hand stays still: the swing settles back by itself
    h.swing += (clamp(vx * SWING_PER_PX, MAX_SWING) - h.swing) * SWING_EASE;
    h.sway += (clamp(vx * SWAY_PER_PX, MAX_SWAY) - h.sway) * SWING_EASE;
    h.tip += (clamp(-vy * TIP_PER_PX, MAX_TIP) - h.tip) * SWING_EASE;
    // Whole pixels and no scaling; turned in 3D about where it is held only while it is (flat and still it is drawn
    // as it is, sharp)
    const at = `translate(${Math.round(x - h.dx)}px, ${Math.round(y - h.dy)}px)`;
    const rx = h.back + h.tip;
    const turned = [rx, h.swing, h.sway].some((a) => Math.abs(a) >= 0.3);
    h.copy.style.transform = turned
      ? `${at} perspective(${HELD_PERSPECTIVE}px) rotateX(${rx.toFixed(1)}deg) rotateY(${h.swing.toFixed(1)}deg) rotateZ(${h.sway.toFixed(1)}deg)`
      : at;
  }

  private letGo(): void {
    const h = this.held;
    if (!h) return;
    this.held = null;
    h.source.ownerDocument.removeEventListener('dragover', this.follow, true);
    h.source.ownerDocument.removeEventListener('drop', this.dropped, true);
    h.source.ownerDocument.removeEventListener('dragend', this.ended, true);
    h.copy.remove();
    h.source.style.opacity = '';
  }

  /**
   * True while a board card is over a drop target (call preventDefault to allow the drop). The card being dragged is
   * known here: Chrome may hand the drop targets an empty drag (no types) once the page changes during it (the card
   * picked up, its place emptied), so its data is only a fallback.
   */
  accepts(event: DragEvent): boolean {
    return this.dragging() !== null || !!event.dataTransfer?.types.includes(DRAG_TYPE);
  }

  read(event: DragEvent): DraggedCard | null {
    const held = this.dragging();
    this.dragging.set(null);
    if (held) return held;
    const raw = event.dataTransfer?.getData(DRAG_TYPE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DraggedCard;
    } catch {
      return null;
    }
  }

  /** Drop position in % of the element (x, y), from the owner's point of view. */
  position(event: DragEvent, element: HTMLElement, mirrored = false): { x: number; y: number } {
    // Over one of the field's lines (the browser finds it even on the leaning table, where the halves of the box on
    // screen are not the lines): its middle, front line above 50
    const line = event.target instanceof Element ? event.target.closest('.line') : null;
    if (line && element.contains(line)) {
      const rect = line.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      return { x: Math.max(0, Math.min(100, x)), y: line.classList.contains('front') ? 25 : 75 };
    }
    const rect = element.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, mirrored ? 100 - y : y)) };
  }
}
