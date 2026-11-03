/**
 * Width of `count` card-shaped items (`ratio` = width / height) laid in rows inside a `width` × `height` box with
 * `gap` between them, as big as they can be with every item visible (no scrolling), and never wider than `max`.
 */
export function fitItemWidth(count: number, width: number, height: number, ratio: number, gap: number, max: number): number {
  if (count <= 0 || width <= 0 || height <= 0) return 0;
  let best = 0;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const byWidth = (width - gap * (columns - 1)) / columns;
    const byHeight = ((height - gap * (rows - 1)) / rows) * ratio;
    best = Math.max(best, Math.min(byWidth, byHeight));
  }
  return Math.max(0, Math.min(max, Math.floor(best)));
}
