/**
 * Sends a pack's cards flying out of where it broke: each card of `cards` (its children, already laid out) starts at
 * the middle of `stage`, small and turned, and flies to its place one after another (`stagger` ms apart). Read by
 * eras-opening-card's deal animation (--from-x, --from-y, --from-rot, --from-scale, --deal-delay).
 */
export function dealFromCenter(cards: HTMLElement, stage: HTMLElement, stagger: number): void {
  const center = stage.getBoundingClientRect();
  const cx = center.left + center.width / 2;
  const cy = center.top + center.height / 2;
  Array.from(cards.children).forEach((child, i) => {
    if (!(child instanceof HTMLElement)) return;
    const box = child.getBoundingClientRect();
    child.style.setProperty('--from-x', `${cx - (box.left + box.width / 2)}px`);
    child.style.setProperty('--from-y', `${cy - (box.top + box.height / 2)}px`);
    child.style.setProperty('--from-rot', `${Math.round((Math.random() - 0.5) * 50)}deg`);
    child.style.setProperty('--from-scale', '0.35');
    child.style.setProperty('--deal-delay', `${i * stagger}ms`);
  });
}
