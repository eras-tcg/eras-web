import { BoardAnimations } from './board-animations';
import { TIMING } from './timing';

/** The id of a card's slide in its row (to find it again). */
const SLIDE = 'eras-row-slide';

/**
 * The cards of a row slide to their new places when its order changes (two creatures swap places, one is put in a new place of the
 * row, the row closes up when one leaves): where each card was is measured before the row is drawn again, and once drawn each card
 * that stayed in it travels from there (FLIP). In layout pixels and with `translate`, so it works on the leaning table, on the
 * rival's half and while the row is slid sideways, and never fights a card's own transform. Cards new to the row are left alone (they
 * fly or glide in on their own, CardMotions).
 */
export class RowSlide {
  private before = new Map<string, number>();
  /** Something was playing when the row changed: the cards wait where they were until it ends. */
  private deferring = false;
  /** Each card's latest slide: one held for later is dropped when a newer one starts. */
  private readonly latest = new WeakMap<HTMLElement, number>();
  private count = 0;

  constructor(private readonly animations: BoardAnimations | null) {}

  /** Before the row is drawn again: where each card stands now (where a slide under way has it). */
  measure(cards: readonly HTMLElement[]): void {
    this.deferring = !(this.animations?.idle() ?? true);
    this.before = new Map();
    for (const el of cards) {
      const id = el.dataset['instanceId'];
      if (!id) continue;
      this.before.set(id, el.offsetLeft + shownShift(el));
      for (const a of el.getAnimations()) if (a.id === SLIDE) a.cancel();
      el.style.translate = '';
      this.latest.delete(el);
    }
  }

  /** Once drawn: each card that stayed in the row slides from where it was to where it is now. */
  play(cards: readonly HTMLElement[]): void {
    const before = this.before;
    this.before = new Map();
    if (!this.animations || this.animations.still()) return;
    const moves: { el: HTMLElement; dx: number }[] = [];
    for (const el of cards) {
      const was = before.get(el.dataset['instanceId'] ?? '');
      if (was === undefined) continue;
      const dx = was - el.offsetLeft;
      if (Math.abs(dx) >= 1) moves.push({ el, dx });
    }
    if (!moves.length) return;
    const animations = this.animations;
    const token = ++this.count;
    for (const m of moves) this.latest.set(m.el, token);
    const start = () => {
      const live = moves.filter((m) => this.latest.get(m.el) === token);
      if (!live.length) return;
      animations.hold(TIMING.slide);
      for (const { el, dx } of live) {
        el.style.translate = '';
        el.animate([{ translate: `${dx}px 0` }, { translate: '0 0' }], { id: SLIDE, duration: TIMING.slide, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
      }
    };
    if (!this.deferring) return start();
    // Held where they were while what plays ends
    for (const { el, dx } of moves) el.style.translate = `${dx}px 0`;
    animations.whenIdle(start);
  }
}

/** How far a card is shifted sideways now by its slide (0: none). */
function shownShift(el: HTMLElement): number {
  const t = getComputedStyle(el).translate;
  return t && t !== 'none' ? parseFloat(t) || 0 : 0;
}
