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
MINIMAL = True  # instead: the gem in line only (its girdle, table and the five edges between them)
STROKE = 0.024  # the line's width, as a share of the gem's size
CUT = 0.22  # the cuts' length, as a share of the edge they open
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


def minimal_gem(scene, size):
    """The gem drawn in line over `scene` (H×W×4 floats), centered, `size` across: a translucent dark inside, so it reads
    over the vortex, and light lines (the logo's girdle, table and edges) cut at one end, turning with the vortex, with a
    soft blue glow."""
    ih, iw = scene.shape[:2]
    ss = 3
    k = size / 512 * ss
    ox, oy = (iw - size) / 2 * ss, (ih - size) / 2 * ss
    to = lambda p: (ox + p[0] * k, oy + p[1] * k)
    fill = Image.new('L', (iw * ss, ih * ss), 0)
    lines = Image.new('L', (iw * ss, ih * ss), 0)
    ImageDraw.Draw(fill).polygon([to(p) for p in geo.D], fill=255)
    d = ImageDraw.Draw(lines)
    width = max(1, round(size * STROKE * ss))

    def stroke(p, q, cut_start, cut_end):
        """One edge from p to q, cut short at each end by those shares of its length, with round ends."""
        (px, py), (qx, qy) = to(p), to(q)
        a = (px + (qx - px) * cut_start, py + (qy - py) * cut_start)
        b = (qx - (qx - px) * cut_end, qy - (qy - py) * cut_end)
        d.line([a, b], fill=255, width=width)
        for x, y in (a, b):
            d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=255)

    # Five cuts turning with the vortex: the girdle opens after each edge's foot (every other side), the table at the
    # end of each side, and each edge leaves the table whole and stops short of the girdle
    for j in range(10):
        stroke(geo.D[j], geo.D[(j + 1) % 10], CUT if j % 2 == 0 else 0, 0)
    for kk in range(5):
        stroke(geo.P[kk], geo.P[(kk + 1) % 5], 0, CUT * 0.6)
        stroke(geo.P[kk], geo.D[2 * kk], 0, CUT * 0.7)
    fill = np.asarray(fill.resize((iw, ih), Image.LANCZOS), np.float32)[..., None] / 255
    line = np.asarray(lines.resize((iw, ih), Image.LANCZOS), np.float32)[..., None] / 255
    rgb = scene[..., :3]
    rgb = rgb * (1 - fill * 0.6)                                   # the dark inside
    glow = blur(line, size * 0.025) * 1.6
    rgb = 1 - (1 - rgb) * (1 - np.clip(glow, 0, 1) * np.array([0.38, 0.65, 0.98], np.float32) * 0.8)
    rgb = rgb * (1 - line) + np.array([0.86, 0.92, 1.0], np.float32) * line
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
