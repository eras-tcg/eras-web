"""Draws the ERAS gem (variant A, Zafiro) straight into PNG, layer by layer, with the geometry of build_gem.py: the
site's raster icons (logo, PWA "any" and "maskable", Apple touch). Drawn at 3× and scaled down for smooth edges.

    python render_png.py <public_dir>
"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw

import build_gem as g

SS = 3  # supersampling


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255


class Canvas:
    def __init__(self, size):
        self.size = size
        self.k = size / 512.0
        self.rgb = np.zeros((size, size, 3), np.float32)
        self.a = np.zeros((size, size), np.float32)
        ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
        self.xs, self.ys = (xs + 0.5) / self.k, (ys + 0.5) / self.k  # in the 512 design space

    def mask(self, points):
        im = Image.new('L', (self.size, self.size), 0)
        ImageDraw.Draw(im).polygon([(x * self.k, y * self.k) for x, y in points], fill=255)
        return np.asarray(im, np.float32) / 255

    def over(self, color, alpha):
        """Paints `color` (H×W×3 or 3) with `alpha` (H×W) over what is there (source-over)."""
        a = np.clip(alpha, 0, 1)
        out_a = a + self.a * (1 - a)
        safe = np.where(out_a > 0, out_a, 1)
        self.rgb = (color * a[..., None] + self.rgb * self.a[..., None] * (1 - a[..., None])) / safe[..., None]
        self.a = out_a

    def bbox_t(self, points, x1, y1, x2, y2):
        """A linear gradient's 0..1 position in the polygon's bounding box (objectBoundingBox units)."""
        xs_, ys_ = [p[0] for p in points], [p[1] for p in points]
        bx, by, bw, bh = min(xs_), min(ys_), max(xs_) - min(xs_), max(ys_) - min(ys_)
        u, v = (self.xs - bx) / bw, (self.ys - by) / bh
        dx, dy = x2 - x1, y2 - y1
        return np.clip(((u - x1) * dx + (v - y1) * dy) / (dx * dx + dy * dy), 0, 1)

    def line(self, p, q, width, color, opacity):
        im = Image.new('L', (self.size, self.size), 0)
        ImageDraw.Draw(im).line([(p[0] * self.k, p[1] * self.k), (q[0] * self.k, q[1] * self.k)], fill=255, width=max(1, round(width * self.k)))
        self.over(hexrgb(color), np.asarray(im, np.float32) / 255 * opacity)

    def circle(self, cx, cy, r, color, opacity):
        d = np.hypot(self.xs - cx, self.ys - cy)
        self.over(hexrgb(color), np.clip(r - d + 0.5, 0, 1) * opacity)


def lerp(a, b, t):
    return a + (b - a) * t


def draw_gem(size, table=('#bfe6ff', '#1d5fa8'), faces=g.SAPPHIRE, glow=None):
    c = Canvas(size)
    if glow:
        d = np.hypot(c.xs - g.C[0], c.ys - g.C[1]) / (g.R * 1.22)
        c.over(hexrgb(glow), np.where(d < 0.55, 0.45, np.clip(0.45 * (1 - (d - 0.55) / 0.45), 0, 0.45)))
    c.over(hexrgb('#0a1426'), c.mask(g.D))  # base
    x1, y1 = 0.5 - 0.5 * math.cos(g.LIGHT), 0.5 + 0.5 * math.sin(g.LIGHT)
    for k in range(5):  # facetas
        light, dark = (hexrgb(x) for x in faces[k])
        t = g.lit(k)
        face = g.face(k)
        pos = c.bbox_t(face, x1, y1, 1 - x1, 1 - y1)
        c0, c1 = lerp(dark, light, 0.35 + 0.65 * t), lerp(dark, light, 0.15 * t)
        c.over(lerp(c0, c1, pos[..., None]), c.mask(face))
        m = ((g.P[k][0] + g.P[(k + 1) % 5][0]) / 2, (g.P[k][1] + g.P[(k + 1) % 5][1]) / 2)
        gd = g.D[(2 * k + 1) % 10]
        c.over(np.ones(3, np.float32), c.mask([g.P[k], gd, m]) * (0.05 + 0.12 * t))
        c.over(np.zeros(3, np.float32), c.mask([m, gd, g.P[(k + 1) % 5]]) * (0.10 + 0.10 * (1 - t)))
    tl, td = hexrgb(table[0]), hexrgb(table[1])  # mesa: radial gradient, cx 38% cy 32% r 80% of its box
    xs_, ys_ = [p[0] for p in g.P], [p[1] for p in g.P]
    bx, by, bw, bh = min(xs_), min(ys_), max(xs_) - min(xs_), max(ys_) - min(ys_)
    rr = np.clip(np.hypot((c.xs - (bx + 0.38 * bw)) / (0.8 * bw), (c.ys - (by + 0.32 * bh)) / (0.8 * bh)), 0, 1)
    c.over(lerp(tl, td, rr[..., None]), c.mask(g.P))
    inner = [g.pt(g.r * 0.42, 90 + 72 * k + 36) for k in range(5)]
    for k in range(5):
        c.over(np.ones(3, np.float32), c.mask([g.P[k], inner[k], g.P[(k + 1) % 5]]) * (0.04 + 0.10 * g.lit(k)))
    edges = [(g.P[k], g.P[(k + 1) % 5]) for k in range(5)] + [(g.P[k], g.D[2 * k]) for k in range(5)] + [(g.D[j], g.D[(j + 1) % 10]) for j in range(10)]
    for p, q in edges:  # aristas
        c.line(p, q, 2.5, '#e6f1ff', 0.55)
    s0, s1, s2 = g.pt(g.r * 0.78, 90 + 72 - 10), g.pt(g.r * 0.55, 110), g.pt(g.r * 0.20, 130)
    c.over(np.ones(3, np.float32), c.mask([s0, s1, s2]) * 0.35)  # brillos
    c.circle(g.D[1][0] + 10, g.D[1][1] + 8, 12, '#ffffff', 0.18)
    c.circle(g.D[1][0] + 10, g.D[1][1] + 8, 5, '#ffffff', 0.85)
    rgba = np.dstack([c.rgb, c.a])
    return Image.fromarray((np.clip(rgba, 0, 1) * 255).round().astype(np.uint8), 'RGBA')


def icon(out, size, scale=1.0, background=None):
    """The gem at `scale` of the icon (1: as the SVG, girdle 200/512), over `background` or transparent."""
    gem = draw_gem(512 * SS).resize((round(size * scale), round(size * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), background or (0, 0, 0, 0))
    off = (size - gem.width) // 2
    canvas.alpha_composite(gem, (off, off))
    canvas.save(out)
    print(out, canvas.size)


if __name__ == '__main__':
    pub = sys.argv[1]
    dark = (20, 20, 20, 255)
    icon(f'{pub}/logo.png', 512)
    icon(f'{pub}/icons/icon-512.png', 512)
    icon(f'{pub}/icons/icon-192.png', 192)
    icon(f'{pub}/icons/maskable-512.png', 512, 0.72, dark)  # within the maskable safe zone (80 %)
    icon(f'{pub}/icons/maskable-192.png', 192, 0.72, dark)
    icon(f'{pub}/icons/apple-touch-icon.png', 180, 1.12, dark)
