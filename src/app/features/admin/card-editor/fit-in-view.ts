/** Shifts an element by the least needed so it fits in its scrolling viewport (or the window), with a small margin. */
export function fitInView(el: HTMLElement): void {
  const margin = 8;
  el.style.translate = '';
  const box = (el.closest('.viewport') ?? document.documentElement).getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const shift = (start: number, end: number, min: number, max: number) => {
    if (end > max - margin) return Math.max(max - margin - end, min + margin - start);
    if (start < min + margin) return min + margin - start;
    return 0;
  };
  const dx = shift(r.left, r.right, box.left, box.right);
  const dy = shift(r.top, r.bottom, box.top, box.bottom);
  if (dx || dy) el.style.translate = `${dx}px ${dy}px`;
}
