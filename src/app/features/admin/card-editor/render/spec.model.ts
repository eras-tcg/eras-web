/**
 * Card template specs, extracted from the designer's Photoshop prototypes by `card-maker/extract.py` and served from
 * `public/card-maker/templates.json`. Coordinates are pixels of the 744x1039 card (63x88 mm at 300 dpi).
 */

export interface GradientStop {
  at: number;
  color: string;
}

export interface Gradient {
  /** "Lnr" (linear) or "Rdl" (radial). */
  type: string;
  /** Photoshop angle: 0 = left to right, 90 = bottom to top. */
  angle: number;
  scale: number;
  reverse: boolean;
  stops: GradientStop[];
  alphas: { at: number; a: number }[];
}

export type Paint = string | { gradient: Gradient } | null;

export interface Stroke {
  width: number;
  /** strokeStyleAlignInside / Center / Outside. */
  align: string;
  opacity: number;
  color: string | null;
  gradient: Gradient | null;
}

export interface FxStroke {
  size: number;
  /** InsF / CtrF / OutF. */
  pos: string;
  opacity: number;
  color: string | null;
  gradient: Gradient | null;
}

export interface Bevel {
  size: number;
  /** Depth in percent. */
  depth?: number;
  angle: number;
  altitude?: number;
  /** Uses the document's global light instead of its own angle and altitude. */
  useGlobal?: boolean;
  hi: string | null;
  hiOpacity: number;
  sh: string | null;
  shOpacity: number;
}

export interface LayerFx {
  stroke?: FxStroke;
  bevel?: Bevel;
  colorOverlay?: { color: string | null; opacity: number };
  gradientOverlay?: { opacity: number; gradient: Gradient | null };
}

export interface TextRun {
  text: string;
  font: string;
  size: number;
  color: string | null;
  tracking?: number;
  leading?: number | null;
  autoLeading?: boolean;
}

export interface TextSpec {
  text: string;
  runs: TextRun[];
  justify: 'left' | 'right' | 'center' | 'justify';
  /** [xx, xy, yx, yy, tx, ty]. */
  transform: number[];
  /** Paragraph frame [left, top, right, bottom] in text units; null for point text. */
  box: number[] | null;
}

export interface SubPath {
  d: string;
  /** 0 exclude, 1 combine, 2 subtract, 3 intersect. */
  op: number;
}

export interface SpecNode {
  name: string;
  kind: string;
  visible: boolean;
  opacity: number;
  fillOpacity?: number;
  bbox: number[];
  children?: SpecNode[];
  paths?: SubPath[];
  fill?: Paint;
  stroke?: Stroke;
  fx?: LayerFx;
  text?: TextSpec;
  /** PNG data URL of a pixel layer, the card art for the background, or null. */
  raster?: string | null;
  /** The PSD's grey art placeholder. */
  placeholder?: boolean;
  /** Card art placement over the whole card. */
  art?: ArtPlacement | null;
}

export interface CardSpec {
  width: number;
  height: number;
  /** Photoshop's global light, used by the bevels that follow it. */
  light?: { angle: number; altitude: number };
  layers: SpecNode[];
}

/** Art scale and offset: the image covers the card at scale 1, then is zoomed and moved (pixels). */
export interface ArtPlacement {
  src: string;
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
}

export interface PieceStyle {
  label: string;
  /** [offset, color, CMYK in percent?] stops, bottom to top. */
  fill: ([number, string] | [number, string, number[]])[];
  text: string | null;
  textStroke: string | null;
  textStrokeSize: number | null;
  border?: string;
}

export interface PieceTable {
  timings: Record<string, PieceStyle>;
  conditions: Record<string, PieceStyle>;
  keywords: Record<string, PieceStyle>;
}
