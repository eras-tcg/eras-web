import { BevelLight, bevelMaps } from './bevel';
import { ArtPlacement, Bevel, CardSpec, Gradient, Paint, SpecNode } from './spec.model';

const NS = 'http://www.w3.org/2000/svg';
/** Bevel images by layer content, shared by every redraw. */
const BEVEL_CACHE = new Map<string, { hi: string; sh: string }>();
const BIG = { x: -50, y: -50, width: 900, height: 1200 };

/** Photoshop font names -> CSS family, weight and style (families come from card-fonts.ts). */
export const CARD_FONTS: Record<string, [string, number, string]> = {
  'BookAntiqua-Bold': ['"ERAS Book Antiqua"', 700, 'normal'],
  'AgencyFB-Bold': ['"ERAS Agency FB"', 700, 'normal'],
  'Arial-BoldMT': ['"ERAS Arial"', 700, 'normal'],
  'Arial-BoldItalicMT': ['"ERAS Arial"', 700, 'italic'],
  ArialMT: ['"ERAS Arial"', 400, 'normal'],
  'Arial-ItalicMT': ['"ERAS Arial"', 400, 'italic'],
};

export type Attrs = Record<string, string | number | null | undefined>;

export function svgEl(name: string, attrs: Attrs, parent?: Element): SVGElement {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs))
    if (v !== undefined && v !== null) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

/** Renders a spec as an SVG element. Layers are bottom to top; invisible layers are skipped. */
export class SvgRenderer {
  private uid = 0;
  private readonly bevels: { g: SVGElement; bevel: Bevel; bbox: number[] }[] = [];
  readonly svg: SVGSVGElement;
  readonly defs: SVGElement;

  constructor(
    private readonly spec: CardSpec,
    fontCss: string,
  ) {
    this.svg = svgEl('svg', {
      xmlns: NS,
      viewBox: `0 0 ${spec.width} ${spec.height}`,
      width: spec.width,
      height: spec.height,
    }) as SVGSVGElement;
    this.defs = svgEl('defs', {}, this.svg);
    // The fonts travel inside the SVG, so the exported image (drawn from the SVG alone) keeps them.
    svgEl('style', {}, this.defs).textContent = fontCss;
  }

  id(prefix: string): string {
    return `${prefix}${++this.uid}`;
  }

  render(): SVGSVGElement {
    this.draw(this.spec.layers, this.svg);
    return this.svg;
  }

  private draw(nodes: SpecNode[], parent: Element): void {
    for (const n of nodes) {
      if (!n.visible) continue;
      const g = svgEl(
        'g',
        { opacity: n.opacity !== 1 ? n.opacity : null, 'data-name': n.name },
        parent,
      );
      if (n.children) this.draw(n.children, g);
      else if (n.art) this.drawArt(n.art, g);
      else if (n.placeholder)
        svgEl(
          'rect',
          { x: 0, y: 0, width: this.spec.width, height: this.spec.height, fill: '#71898a' },
          g,
        );
      else if (typeof n.raster === 'string') this.drawRaster(n, g);
      else if (n.paths) this.drawShape(n, g);
      else if (n.text) this.drawText(n, g);
      if (n.fx?.bevel && !n.children) {
        // A text's PSD box fits the prototype's text, not the new one: take the whole card width.
        const bbox = n.text ? [0, n.bbox[1], this.spec.width, n.bbox[3]] : n.bbox;
        this.bevels.push({ g, bevel: n.fx.bevel, bbox });
      }
    }
  }

  /**
   * Adds the bevels: each beveled layer is rasterized alone, its highlight and shadow computed from that alpha and
   * laid over it as images blended like Photoshop (screen / multiply). Runs after render(), before exporting.
   */
  async bake(): Promise<void> {
    const pad = 3;
    const light = this.spec.light ?? { angle: 120, altitude: 30 };
    await Promise.all(
      this.bevels.map(async ({ g, bevel, bbox }) => {
        const x0 = Math.floor(Math.max(0, bbox[0] - pad));
        const y0 = Math.floor(Math.max(0, bbox[1] - pad));
        const w = Math.ceil(Math.min(this.spec.width, bbox[2] + pad)) - x0;
        const h = Math.ceil(Math.min(this.spec.height, bbox[3] + pad)) - y0;
        if (w <= 0 || h <= 0) return;
        const own = !bevel.useGlobal;
        const params = {
          size: bevel.size,
          depth: bevel.depth ?? 100,
          angle: own ? bevel.angle : light.angle,
          altitude: own ? (bevel.altitude ?? 30) : light.altitude,
        };
        // The same layer looks the same on every redraw (moving the art changes none of them): reuse its bevel.
        const key = JSON.stringify([
          this.layerSource(g),
          x0,
          y0,
          w,
          h,
          params,
          bevel.hi,
          bevel.sh,
          bevel.hiOpacity,
          bevel.shOpacity,
        ]);
        let images = BEVEL_CACHE.get(key);
        if (!images) {
          images = await this.bevelImages(g, x0, y0, w, h, bevel, params);
          BEVEL_CACHE.set(key, images);
          if (BEVEL_CACHE.size > 300) BEVEL_CACHE.delete(BEVEL_CACHE.keys().next().value!);
        }
        svgEl(
          'image',
          { href: images.hi, x: x0, y: y0, width: w, height: h, style: 'mix-blend-mode:screen' },
          g,
        );
        svgEl(
          'image',
          { href: images.sh, x: x0, y: y0, width: w, height: h, style: 'mix-blend-mode:multiply' },
          g,
        );
      }),
    );
  }

  /** A layer's markup plus the definitions it uses (gradients, masks), which together decide how it looks. */
  private layerSource(g: SVGElement): string {
    const xml = new XMLSerializer();
    const ids = new Set([...g.outerHTML.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]));
    const defs = [...ids]
      .map((id) => this.defs.querySelector(`#${CSS.escape(id)}`))
      .map((d) => (d ? xml.serializeToString(d) : ''));
    return xml.serializeToString(g) + defs.join('');
  }

  /** Highlight and shadow of one layer's bevel, as PNG data URLs over its region. */
  private async bevelImages(
    g: SVGElement,
    x0: number,
    y0: number,
    w: number,
    h: number,
    bevel: Bevel,
    params: BevelLight,
  ): Promise<{ hi: string; sh: string }> {
    const scale = 4;
    const fine = await this.layerAlpha(g, x0, y0, w, h, scale);
    const maps = bevelMaps(fine, w, h, params, scale);
    const image = (values: Float32Array, color: string, opacity: number) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      const img = ctx.createImageData(w, h);
      const [r, gg, b] = hexRgb(color);
      for (let i = 0; i < w * h; i++) {
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = gg;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = Math.round(255 * values[i] * opacity * maps.alpha[i]);
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL('image/png');
    };
    return {
      hi: image(maps.hi, bevel.hi || '#ffffff', bevel.hiOpacity),
      sh: image(maps.sh, bevel.sh || '#000000', bevel.shOpacity),
    };
  }

  /** Alpha (0..1) of one layer group alone, over a region of the card, drawn `scale` times larger. */
  private async layerAlpha(
    g: SVGElement,
    x0: number,
    y0: number,
    w: number,
    h: number,
    scale: number,
  ): Promise<Float32Array> {
    const NSX = 'http://www.w3.org/2000/svg';
    const solo = document.createElementNS(NSX, 'svg');
    solo.setAttribute('xmlns', NSX);
    solo.setAttribute('viewBox', `${x0} ${y0} ${w} ${h}`);
    solo.setAttribute('width', String(w * scale));
    solo.setAttribute('height', String(h * scale));
    solo.appendChild(this.defs.cloneNode(true));
    const copy = g.cloneNode(true) as SVGElement;
    copy.removeAttribute('opacity');
    solo.appendChild(copy);
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(solo)], { type: 'image/svg+xml' }),
    );
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const W = w * scale;
      const H = h * scale;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      const out = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) out[i] = data[i * 4 + 3] / 255;
      return out;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private drawArt(art: ArtPlacement, g: Element): void {
    svgEl(
      'rect',
      { x: 0, y: 0, width: this.spec.width, height: this.spec.height, fill: '#000' },
      g,
    );
    const cover = Math.max(this.spec.width / art.width, this.spec.height / art.height) * art.scale;
    const w = art.width * cover;
    const h = art.height * cover;
    svgEl(
      'image',
      {
        href: art.src,
        x: (this.spec.width - w) / 2 + art.x,
        y: (this.spec.height - h) / 2 + art.y,
        width: w,
        height: h,
        preserveAspectRatio: 'none',
      },
      g,
    );
  }

  private drawRaster(n: SpecNode, g: Element): void {
    const [x0, y0, x1, y1] = n.bbox;
    let clip: string | null = null;
    if (n.paths?.length) {
      const cid = this.id('r');
      const cp = svgEl('clipPath', { id: cid }, this.defs);
      svgEl('path', { d: n.paths.map((p) => p.d).join(' '), 'clip-rule': 'evenodd' }, cp);
      clip = `url(#${cid})`;
    }
    svgEl(
      'image',
      { href: n.raster, x: x0, y: y0, width: x1 - x0, height: y1 - y0, 'clip-path': clip },
      g,
    );
  }

  gradient(g: Gradient, bbox: number[]): string {
    const gid = this.id('g');
    const [x0, y0, x1, y1] = bbox;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const a = (g.angle * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = -Math.sin(a);
    const half = ((Math.abs(dx) * (x1 - x0) + Math.abs(dy) * (y1 - y0)) / 2) * (g.scale / 100);
    let p1 = [cx - dx * half, cy - dy * half];
    let p2 = [cx + dx * half, cy + dy * half];
    if (g.reverse) [p1, p2] = [p2, p1];
    const node = /Rdl/.test(g.type)
      ? svgEl(
          'radialGradient',
          { id: gid, gradientUnits: 'userSpaceOnUse', cx, cy, r: half },
          this.defs,
        )
      : svgEl(
          'linearGradient',
          { id: gid, gradientUnits: 'userSpaceOnUse', x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] },
          this.defs,
        );
    for (const s of g.stops)
      svgEl(
        'stop',
        { offset: s.at, 'stop-color': s.color, 'stop-opacity': alphaAt(g, s.at) },
        node,
      );
    return `url(#${gid})`;
  }

  paint(p: Paint | undefined, bbox: number[]): string {
    if (!p) return 'none';
    if (typeof p === 'string') return p;
    return this.gradient(p.gradient, bbox);
  }

  private drawShape(n: SpecNode, parent: Element): void {
    const paths = n.paths ?? [];
    if (!paths.length) return;
    const d = paths.map((p) => p.d).join(' ');
    const hasSub = paths.some((p) => p.op !== 1);
    const g = svgEl('g', {}, parent);
    // Shape area as a mask: subpaths apply in order (combine paints white, subtract black).
    const shapeMask = (invert: boolean): string => {
      const mid = this.id('m');
      const m = svgEl('mask', { id: mid, maskUnits: 'userSpaceOnUse', ...BIG }, this.defs);
      if (invert) svgEl('rect', { ...BIG, fill: 'white' }, m);
      if (hasSub)
        for (const p of paths)
          svgEl('path', { d: p.d, fill: (p.op === 2) !== invert ? 'black' : 'white' }, m);
      else svgEl('path', { d, fill: invert ? 'black' : 'white' }, m);
      return `url(#${mid})`;
    };
    const inMask = shapeMask(false);
    const outMask = shapeMask(true);
    const area = (attrs: Attrs, where: Element) =>
      hasSub
        ? svgEl('rect', { ...BIG, ...attrs, mask: inMask }, where)
        : svgEl('path', { d, ...attrs }, where);
    const fx = n.fx ?? {};
    const strokes: { w: number; align: string; paint: Paint; op: number }[] = [];
    if (n.stroke)
      strokes.push({
        w: n.stroke.width,
        align: n.stroke.align,
        paint: n.stroke.gradient ? { gradient: n.stroke.gradient } : n.stroke.color,
        op: n.stroke.opacity,
      });
    if (fx.stroke)
      strokes.push({
        w: fx.stroke.size,
        align: fx.stroke.pos,
        paint: fx.stroke.gradient ? { gradient: fx.stroke.gradient } : fx.stroke.color,
        op: fx.stroke.opacity,
      });
    const stroke = (s: (typeof strokes)[number], where: Element) => {
      const inside = /Inside|InsF/.test(s.align);
      const outside = /Outside|OutF/.test(s.align);
      const holder =
        inside || outside ? svgEl('g', { mask: inside ? inMask : outMask }, where) : where;
      svgEl(
        'path',
        {
          d,
          fill: 'none',
          stroke: this.paint(s.paint, n.bbox),
          'stroke-width': inside || outside ? s.w * 2 : s.w,
          'stroke-opacity': s.op,
          'stroke-linejoin': 'round',
        },
        holder,
      );
    };
    const fillOpacity = n.fillOpacity ?? 1;
    if (n.fill && fillOpacity > 0)
      area({ fill: this.paint(n.fill, n.bbox), 'fill-opacity': fillOpacity }, g);
    if (fx.colorOverlay?.color)
      area({ fill: fx.colorOverlay.color, 'fill-opacity': fx.colorOverlay.opacity }, g);
    if (fx.gradientOverlay?.gradient)
      area(
        {
          fill: this.gradient(fx.gradientOverlay.gradient, n.bbox),
          'fill-opacity': fx.gradientOverlay.opacity,
        },
        g,
      );
    for (const s of strokes) stroke(s, g);
  }

  private drawText(n: SpecNode, parent: Element): void {
    const t = n.text!;
    const [xx, , , yy, tx, ty] = t.transform;
    const lines = t.text.replace(/\r$/, '').split('\r');
    const run = t.runs[0];
    const [family, weight, style] = CARD_FONTS[run?.font ?? ''] ?? ['sans-serif', 400, 'normal'];
    const size = (run?.size || 12) * yy;
    const lead = run?.autoLeading === false && run.leading ? run.leading * yy : size * 1.2;
    const anchor = t.justify === 'center' ? 'middle' : t.justify === 'right' ? 'end' : 'start';
    let x = tx;
    let y = ty;
    if (t.box) {
      // The box starts at the text's origin; Photoshop keeps an unused offset in its left/top values.
      const [l, , r] = t.box;
      x = tx + (anchor === 'middle' ? ((r - l) / 2) * xx : anchor === 'end' ? (r - l) * xx : 0);
      y = ty + size * 0.73;
    }
    const fx = n.fx ?? {};
    const te = svgEl(
      'text',
      {
        x,
        y,
        fill: run?.color || '#000',
        'font-family': family,
        'font-weight': weight,
        'font-style': style,
        'font-size': size,
        'text-anchor': anchor,
        'letter-spacing': run?.tracking ? (run.tracking / 1000) * size : null,
        stroke: fx.stroke?.color ?? null,
        'stroke-width': fx.stroke
          ? fx.stroke.size * (/OutF|InsF/.test(fx.stroke.pos) ? 2 : 1)
          : null,
        'paint-order': fx.stroke ? 'stroke' : null,
        'stroke-linejoin': fx.stroke ? 'round' : null,
        // Horizontal scale of the PSD text (width over height), anchored at the text's x.
        transform:
          Math.abs(xx / yy - 1) > 0.005
            ? `translate(${x} 0) scale(${xx / yy} 1) translate(${-x} 0)`
            : null,
      },
      parent,
    );
    lines.forEach((ln, i) => {
      svgEl('tspan', { x, dy: i ? lead : 0 }, te).textContent = ln;
    });
  }
}

function hexRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function alphaAt(g: Gradient, t: number): number {
  const al = g.alphas ?? [];
  if (!al.length) return 1;
  if (t <= al[0].at) return al[0].a;
  for (let i = 1; i < al.length; i++) {
    if (t <= al[i].at) {
      const f = (t - al[i - 1].at) / (al[i].at - al[i - 1].at || 1);
      return al[i - 1].a + f * (al[i].a - al[i - 1].a);
    }
  }
  return al[al.length - 1].a;
}
