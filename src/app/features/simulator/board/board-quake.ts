import { BoardAnimations } from './board-animations';
import { TIMING } from './timing';

/** Marks what an animation draws over the table, on the screen's body, so it jolts with the table. */
export function quakesWithTable(el: HTMLElement): void {
  el.dataset['simQuake'] = '';
}

/**
 * The table jolts under a blow, a little after `delay`: it and what is drawn over it (marked with `quakesWithTable`)
 * shake and settle. `strength`: 1 a blow, less a landing, more a direct hit. Nothing when nothing moves.
 */
export function quake(document: Document, animations: BoardAnimations, strength: number, delay = 0): void {
  if (animations.still()) return;
  const table = document.querySelector<HTMLElement>('.board .table');
  if (!table) return;
  const targets = [table, ...document.querySelectorAll<HTMLElement>('body > [data-sim-quake]')];
  const a = 7 * strength;
  // Down and to one side first, as struck from above; then less and less
  const steps: [number, number][] = [[0, 0], [-a * 0.6, a], [a, -a * 0.5], [-a * 0.7, a * 0.35], [a * 0.4, -a * 0.2], [-a * 0.15, a * 0.08], [0, 0]];
  const frames = steps.map(([x, y]) => ({ translate: `${x.toFixed(1)}px ${y.toFixed(1)}px` }));
  animations.hold(delay + TIMING.quake);
  for (const el of targets) el.animate(frames, { duration: TIMING.quake, delay, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' });
}
