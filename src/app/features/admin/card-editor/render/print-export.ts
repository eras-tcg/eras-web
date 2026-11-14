/**
 * Card exports: PNG for the web, CMYK TIFF and CMYK PDF for print (63x88 mm at 300 dpi). The CMYK values use the
 * inverse of the plain conversion Photoshop applied to the designer's CMYK files (K = 1 - max(R,G,B)).
 */
export const CARD_DPI = 300;
const MM_TO_PT = 72 / 25.4;

/** Draws an SVG into a canvas at the given scale (every image in the SVG must be a data URL). */
export async function svgToCanvas(svg: SVGSVGElement, scale = 1): Promise<HTMLCanvasElement> {
  const w = Number(svg.getAttribute('width'));
  const h = Number(svg.getAttribute('height'));
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Draws an SVG at `ss` times its size and averages it back down. Photoshop anti-aliases by exact coverage; the
 * browser's own text rendering at card size is hinted and heavier, light text on dark most of all.
 */
export async function svgToCanvasFine(svg: SVGSVGElement, ss = 4): Promise<HTMLCanvasElement> {
  const big = await svgToCanvas(svg, ss);
  const w = Number(svg.getAttribute('width'));
  const h = Number(svg.getAttribute('height'));
  const src = big
    .getContext('2d', { willReadFrequently: true })!
    .getImageData(0, 0, big.width, big.height).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const bw = big.width;
  const n = ss * ss;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Average premultiplied colors so transparent samples do not darken the edges.
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < ss; sy++) {
        let i = ((y * ss + sy) * bw + x * ss) * 4;
        for (let sx = 0; sx < ss; sx++, i += 4) {
          const al = src[i + 3];
          r += src[i] * al;
          g += src[i + 1] * al;
          b += src[i + 2] * al;
          a += al;
        }
      }
      const o = (y * w + x) * 4;
      img.data[o] = a ? r / a : 0;
      img.data[o + 1] = a ? g / a : 0;
      img.data[o + 2] = a ? b / a : 0;
      img.data[o + 3] = a / n;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG'))), 'image/png'),
  );
}

/** RGBA pixels → CMYK bytes (alpha is flattened over white). */
export function rgbaToCmyk(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
  const out = new Uint8Array((rgba.length / 4) * 4);
  for (let i = 0, o = 0; i < rgba.length; i += 4, o += 4) {
    const a = rgba[i + 3] / 255;
    const r = (rgba[i] * a + 255 * (1 - a)) / 255;
    const g = (rgba[i + 1] * a + 255 * (1 - a)) / 255;
    const b = (rgba[i + 2] * a + 255 * (1 - a)) / 255;
    const k = 1 - Math.max(r, g, b);
    const den = k < 1 ? 1 - k : 1;
    out[o] = Math.round(((1 - r - k) / den) * 255);
    out[o + 1] = Math.round(((1 - g - k) / den) * 255);
    out[o + 2] = Math.round(((1 - b - k) / den) * 255);
    out[o + 3] = Math.round(k * 255);
  }
  return out;
}

export interface CmykImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export function canvasToCmyk(canvas: HTMLCanvasElement): CmykImage {
  const ctx = canvas.getContext('2d')!;
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return { width: canvas.width, height: canvas.height, data: rgbaToCmyk(px) };
}

/** Uncompressed baseline TIFF, 8-bit CMYK, with its resolution. */
export function cmykTiff(img: CmykImage, dpi = CARD_DPI): Blob {
  const entries: [number, number, number, number][] = []; // tag, type, count, value/offset
  const SHORT = 3;
  const LONG = 4;
  const RATIONAL = 5;
  const headerSize = 8;
  const ifdCount = 12;
  const ifdSize = 2 + ifdCount * 12 + 4;
  const bpsOffset = headerSize + ifdSize;
  const resOffset = bpsOffset + 8;
  const dataOffset = resOffset + 16;
  entries.push([256, LONG, 1, img.width]);
  entries.push([257, LONG, 1, img.height]);
  entries.push([258, SHORT, 4, bpsOffset]);
  entries.push([259, SHORT, 1, 1]); // no compression
  entries.push([262, SHORT, 1, 5]); // separated (CMYK)
  entries.push([273, LONG, 1, dataOffset]);
  entries.push([277, SHORT, 1, 4]);
  entries.push([278, LONG, 1, img.height]);
  entries.push([279, LONG, 1, img.data.length]);
  entries.push([282, RATIONAL, 1, resOffset]);
  entries.push([283, RATIONAL, 1, resOffset + 8]);
  entries.push([296, SHORT, 1, 2]); // inches
  const buf = new ArrayBuffer(dataOffset);
  const v = new DataView(buf);
  v.setUint16(0, 0x4949);
  v.setUint16(2, 42, true);
  v.setUint32(4, headerSize, true);
  v.setUint16(headerSize, ifdCount, true);
  entries.forEach(([tag, type, count, value], i) => {
    const at = headerSize + 2 + i * 12;
    v.setUint16(at, tag, true);
    v.setUint16(at + 2, type, true);
    v.setUint32(at + 4, count, true);
    if (type === SHORT && count === 1) v.setUint16(at + 8, value, true);
    else v.setUint32(at + 8, value, true);
  });
  v.setUint32(headerSize + 2 + ifdCount * 12, 0, true);
  for (let i = 0; i < 4; i++) v.setUint16(bpsOffset + i * 2, 8, true);
  for (const off of [resOffset, resOffset + 8]) {
    v.setUint32(off, dpi, true);
    v.setUint32(off + 4, 1, true);
  }
  return new Blob([buf, img.data as BlobPart], { type: 'image/tiff' });
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** One page per card, each a CMYK image the size of the card (63x88 mm by default). */
export async function cmykPdf(pages: CmykImage[], widthMm = 63, heightMm = 88): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (p: Uint8Array | string) => {
    const bytes = typeof p === 'string' ? enc.encode(p) : p;
    parts.push(bytes as BlobPart);
    length += bytes.length;
  };
  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\n`);
    if (stream) {
      push('stream\n');
      push(stream);
      push('\nendstream\n');
    }
    push('endobj\n');
  };
  const W = (widthMm * MM_TO_PT).toFixed(2);
  const H = (heightMm * MM_TO_PT).toFixed(2);
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  for (let i = 0; i < pages.length; i++) {
    const page = 3 + i * 3;
    const img = pages[i];
    const content = enc.encode(`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`);
    obj(
      page,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${page + 1} 0 R >> >> /Contents ${page + 2} 0 R >>`,
    );
    const data = await deflate(img.data);
    obj(
      page + 1,
      `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceCMYK /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.length} >>`,
      data,
    );
    obj(page + 2, `<< /Length ${content.length} >>`, content);
  }
  const count = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

/** Saves a blob as a download. */
export function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
