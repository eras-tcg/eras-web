"""The ERAS card back, built by layers (no generated imagery), for the web and the simulator: a black ground, the
color vortex of the home (design/home/build_vortex.py) centered on it and fading into it towards the edges, five arms
with a light blue accent, and the ERAS gem (variant A, design/logo) set into its eye: sunk in a shadow, reflecting the vortex,
veiled by it, blooming over it. Same size ratio as the old back (472×660), drawn at 2×.

    python build_cardback.py <out.png>
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, '..', 'home'), os.path.join(HERE, '..', 'logo')]

import build_vortex as v  # noqa: E402
import build_gem as geo  # noqa: E402
import render_png as gem  # noqa: E402

W, H = 472, 660
SHAPE = 3  # the vortex's fade outline: 2 an ellipse, higher nearer the card's rectangle
TWIST = 1.7  # how tightly the arms coil (the home's: 2.6)
ARMS = 5  # the vortex's arms (the home's has 3)
GEM = False  # the ERAS gem, faceted, in the vortex's eye
MINIMAL = True  # instead: the gem flat, its six faces apart by even channels
CHANNEL = 0.022  # the channels' width, as a share of the gem's size
MONO = True  # one flat color for every face (the mark read by its channels alone), no glow
ACCENT = '#38bdf8'  # the vortex's accent arm: a light blue of the palette
K = 2  # output scale
NIGHT = (0, 0, 0, 255)  # the card's ground: black, the vortex fading into it


def arr(im):
    return np.asarray(im.convert('RGBA'), np.float32) / 255


def blur(a, sigma):
    """Gaussian blur of a float H×W×C array (in float, no banding): separable, by FFT, edges padded."""
    pad = int(3 * sigma) + 1
    x = np.pad(a, ((pad, pad), (pad, pad), (0, 0)), mode='edge')
    for axis in (0, 1):
        n = x.shape[axis]
        f = np.fft.rfftfreq(n)
        kernel = np.exp(-2 * (np.pi * f * sigma) ** 2)
        shape = [1, 1, 1]
        shape[axis] = len(f)
        x = np.fft.irfft(np.fft.rfft(x, axis=axis) * kernel.reshape(shape), n=n, axis=axis)
    return x[pad:-pad, pad:-pad].astype(np.float32)


def vortex_on(iw, ih, vortex):
    """The vortex alone, centered on the face, over the night."""
    im = Image.new('RGBA', (iw, ih), NIGHT)
    im.alpha_composite(vortex, ((iw - vortex.width) // 2, (ih - vortex.height) // 2))
    return im


def inset(poly, d):
    """A convex polygon (clockwise or not) moved in by `d` on every side: each side shifted along its inner normal, the
    corners where the shifted sides meet (mitred, so the channels between pieces keep one width)."""
    n = len(poly)
    area = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))
    sign = 1 if area > 0 else -1
    lines = []
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1
        length = (dx * dx + dy * dy) ** 0.5
        nx, ny = -dy / length * sign, dx / length * sign  # inward
        lines.append(((x1 + nx * d, y1 + ny * d), (dx, dy)))
    out = []
    for i in range(n):
        (p1, d1), (p2, d2) = lines[i - 1], lines[i]
        den = d1[0] * d2[1] - d1[1] * d2[0]
        t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den
        out.append((p1[0] + d1[0] * t, p1[1] + d1[1] * t))
    return out


def minimal_gem(scene, size):
    """The gem as flat pieces over `scene` (H×W×4 floats), centered, `size` across: the table and the five side faces of
    the logo, each in one tone by how it faces the light, apart by channels of one width (the cuts), with a soft blue
    glow behind."""
    ih, iw = scene.shape[:2]
    ss = 4
    k = size / 512 * ss
    ox, oy = (iw - size) / 2 * ss, (ih - size) / 2 * ss
    to = lambda p: (ox + p[0] * k, oy + p[1] * k)
    gap = 512 * CHANNEL / 2  # each piece gives half the channel, in the logo's units
    pieces = [(inset(geo.P, gap), 1.0)] + [(inset(geo.face(kk), gap), geo.lit(kk)) for kk in range(5)]
    light, dark = np.array([0.88, 0.95, 1.0], np.float32), np.array([0.09, 0.2, 0.55], np.float32)
    rgb = scene[..., :3]
    # Glow: the gem's light on the vortex, from its silhouette
    sil = Image.new('L', (iw * ss, ih * ss), 0)
    ImageDraw.Draw(sil).polygon([to(p) for p in inset(geo.D, gap)], fill=255)  # the pieces' outer edge: no rim
    sil = np.asarray(sil.resize((iw, ih), Image.LANCZOS), np.float32)[..., None] / 255
    glow = np.clip(blur(sil, size * 0.08) * (0 if MONO else 0.9), 0, 1) * np.array([0.25, 0.5, 0.95], np.float32)
    rgb = 1 - (1 - rgb) * (1 - glow)
    rgb = rgb * (1 - sil * 0.85)  # the channels show a dark ground, not the vortex
    for poly, lit in pieces:
        m = Image.new('L', (iw * ss, ih * ss), 0)
        ImageDraw.Draw(m).polygon([to(p) for p in poly], fill=255)
        m = np.asarray(m.resize((iw, ih), Image.LANCZOS), np.float32)[..., None] / 255
        tone = light if MONO else dark + (light - dark) * (0.1 + 0.9 * lit)
        rgb = rgb * (1 - m) + tone * m
    scene[..., :3] = rgb
    return scene


def cardback():
    w, h = W * K, H * K
    iw, ih = w, h
    inner = Image.new('RGBA', (iw, ih), NIGHT)

    # Vortex: square, a bit taller than the card's face, fading into the black ground evenly towards the card's edges
    # (box: the same for every arm, whichever side it leaves by); its accent a light blue of the palette
    vs = round(ih * 1.15)
    box = (iw / vs, ih / vs)  # the card's half sizes in the vortex's units: every arm widens up to the card's edge
    vortex = v.vortex(vs * 2, accent=ACCENT, fade_out=(0.55, 1.0), n_arms=ARMS, taper=True, twist=TWIST, box=box, shape=SHAPE).filter(ImageFilter.GaussianBlur(6 * 2 * vs / 2048)).resize((vs, vs), Image.LANCZOS)
    inner.alpha_composite(vortex, ((iw - vs) // 2, (ih - vs) // 2))

    if GEM:
        # The gem in the eye, set into the scene rather than laid on it: it sinks into a shadow, its facets reflect the
        # vortex's tones, the vortex's light veils its girdle, and its own light blooms over the arms
        gs = round(vs * 0.25)
        gx, gy = (iw - gs) // 2, (ih - gs) // 2
        scene = arr(inner)
        g = arr(gem.draw_gem(512 * gem.SS).resize((gs, gs), Image.LANCZOS))
        full = np.zeros_like(scene)
        full[gy:gy + gs, gx:gx + gs] = g
        fa = full[..., 3:]

        # Contact shadow: a soft dark ring a little wider than the gem
        sh = blur(fa, gs * 0.08)
        scene[..., :3] *= 1 - np.clip(sh * 1.3, 0, 1) * 0.75

        # Reflections: the vortex's colors, blurred, screened onto the facets
        env = blur(scene[..., :3], gs * 0.12)
        gem_rgb = full[..., :3]
        gem_rgb = 1 - (1 - gem_rgb) * (1 - env * 0.3)
        scene[..., :3] = scene[..., :3] * (1 - fa) + gem_rgb * fa

        # Veil: the vortex passes over the girdle (none on the table, some on the outer facets)
        yy, xx = np.mgrid[0:ih, 0:iw].astype(np.float32)
        rr = np.hypot(xx - iw / 2, yy - ih / 2) / (gs * 200 / 512)  # 1 at the girdle
        veil = np.clip((rr - 0.7) / 0.3, 0, 1) ** 1.5 * 0.6 * fa[..., 0]
        vor = blur(arr(vortex_on(iw, ih, vortex))[..., :3], gs * 0.02)
        scene[..., :3] = scene[..., :3] * (1 - veil[..., None]) + vor * veil[..., None]

        # Bloom: the gem's light spills over the arms
        # (around it, not on it: the facets keep their contrast)
        bloom = blur(gem_rgb * fa, gs * 0.18) * 0.9 + blur(gem_rgb * fa, gs * 0.05) * 0.35
        bloom *= 1 - fa * 0.85
        scene[..., :3] = 1 - (1 - scene[..., :3]) * (1 - np.clip(bloom, 0, 1))

        inner = Image.fromarray((np.clip(scene, 0, 1) * 255).round().astype(np.uint8), 'RGBA')

    if MINIMAL:
        inner = Image.fromarray((np.clip(minimal_gem(arr(inner), round(vs * 0.26)), 0, 1) * 255).round().astype(np.uint8), 'RGBA')

    card = inner
    return card.convert('RGB')


if __name__ == '__main__':
    out = sys.argv[1]
    cardback().save(out, optimize=True)
    print(out)
