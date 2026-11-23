"""The ERAS card back, built by layers (no generated imagery), for the web and the simulator: the card's black border,
the slide's night blue, the color vortex of the home (design/home/build_vortex.py) centered, and the ERAS gem
(variant A, design/logo) set into its eye: sunk in a shadow, reflecting the vortex,
veiled by it, blooming over it. Same size ratio as the old back (472×660, border 16 px), drawn at 2×.

    python build_cardback.py <out.png>
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, '..', 'home'), os.path.join(HERE, '..', 'logo')]

import build_vortex as v  # noqa: E402
import render_png as gem  # noqa: E402

W, H, BORDER = 472, 660, 16
K = 2  # output scale
NIGHT = (8, 10, 22, 255)


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


def cardback():
    w, h, b = W * K, H * K, BORDER * K
    iw, ih = w - 2 * b, h - 2 * b
    inner = Image.new('RGBA', (iw, ih), NIGHT)

    # Vortex: square, a bit taller than the card's face so its arms reach every edge
    vs = round(ih * 1.15)
    vortex = v.vortex(vs * 2).filter(ImageFilter.GaussianBlur(6 * 2 * vs / 2048)).resize((vs, vs), Image.LANCZOS)
    inner.alpha_composite(vortex, ((iw - vs) // 2, (ih - vs) // 2))

    # Vignette: the corners sink into the night, the center stays lit
    ys, xs = np.mgrid[0:ih, 0:iw].astype(np.float32)
    d = np.hypot((xs - iw / 2) / (iw / 2), (ys - ih / 2) / (ih / 2)) / np.sqrt(2)
    shade = np.clip((d - 0.45) / 0.55, 0, 1) ** 1.5 * 0.55
    vign = np.zeros((ih, iw, 4), np.uint8)
    vign[..., :3] = NIGHT[:3]
    vign[..., 3] = (shade * 255).round().astype(np.uint8)
    inner.alpha_composite(Image.fromarray(vign, 'RGBA'))

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

    card = Image.new('RGBA', (w, h), (0, 0, 0, 255))
    card.alpha_composite(inner, (b, b))
    return card.convert('RGB')


if __name__ == '__main__':
    out = sys.argv[1]
    cardback().save(out, optimize=True)
    print(out)
