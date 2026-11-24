"""The ERAS gem «Espiral» (the card back's, design/cardback/build_cardback.py) as the site's icons: favicon.svg (vector:
each face a gold gradient by its light, the table glowing from its heart, the edges cut out by a mask) and the raster
icons (logo, PWA "any" and "maskable", Apple touch), drawn with the card back's own renderer. The site's icons are the
blue gem («Vórtice»'s); without --blue, the gold one («Campeón»'s).

    python render_espiral.py <public_dir> --blue
"""
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, '..', 'cardback')]

import build_cardback as cb  # noqa: E402

DARK = (20, 20, 20, 255)  # the maskable and Apple icons' ground, as before


def ramp_hex(val):
    """The gem's gold at `val` (0..1) on the card back's ramp, as #rrggbb."""
    hexc = lambda h: [int(h[i:i + 2], 16) for i in (1, 3, 5)]
    pos = [p for p, _ in cb.GEM_RAMP]
    rgb = [round(np.interp(min(max(val, 0), 1), pos, [hexc(c)[ch] for _, c in cb.GEM_RAMP])) for ch in range(3)]
    return '#' + ''.join(f'{x:02x}' for x in rgb)


def svg():
    table, faces, strokes = cb.spiral_parts()
    path = lambda pts: 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + ' Z'
    line = lambda pts: 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    lo, hi = cb.FACE_LEVEL
    # the light falls from the top left: each face's gradient runs from its lit corner to its far one
    x1, y1 = 0.5 - 0.5 * math.cos(math.radians(135)), 0.5 + 0.5 * math.sin(math.radians(135))
    defs, shapes = [], []
    for k, f in enumerate(faces):
        lv = lo + (hi - lo) * cb.face_light(f)
        defs.append(f'<linearGradient id="f{k}" x1="{1 - x1:.2f}" y1="{1 - y1:.2f}" x2="{x1:.2f}" y2="{y1:.2f}">'
                    f'<stop offset="0" stop-color="{ramp_hex(lv * cb.TONE_HIGH)}"/>'
                    f'<stop offset="1" stop-color="{ramp_hex(lv * cb.TONE_LOW)}"/></linearGradient>')
        shapes.append(f'<path d="{path(f)}" fill="url(#f{k})"/>')
    tl = cb.TABLE_LEVEL
    defs.append(f'<radialGradient id="t" cx="45%" cy="45%" r="65%"><stop offset="0" stop-color="{ramp_hex(1)}"/>'
                f'<stop offset="0.45" stop-color="{ramp_hex(tl * cb.TONE_HIGH)}"/>'
                f'<stop offset="1" stop-color="{ramp_hex(tl * (cb.TONE_LOW + cb.TONE_HIGH) / 2)}"/></radialGradient>')
    shapes.append(f'<path d="{path(table)}" fill="url(#t)"/>')
    cuts = ''.join(f'<path d="{line(s)}"/>' for s in strokes)
    defs.append(f'<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">'
                f'<rect width="512" height="512" fill="#fff"/>'
                f'<g fill="none" stroke="#000" stroke-width="{cb.VOID}" stroke-linecap="round" stroke-linejoin="round">{cuts}</g></mask>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">'
            '<title>ERAS</title><defs>' + ''.join(defs) + '</defs>'
            '<g mask="url(#cut)">' + ''.join(shapes) + '</g></svg>\n')


def raster(size, scale=1.0, background=None):
    """The gem at `scale` of the icon (1: as the SVG, girdle 200/512), over `background` or transparent."""
    ss = 2
    n = size * ss
    scene = np.zeros((n, n, 4), np.float32)
    cb.minimal_gem(scene, round(n * scale))
    a = scene[..., 3:]
    rgb = np.where(a > 0, scene[..., :3] / np.maximum(a, 1e-6), 0)  # painted over black: un-premultiply
    im = Image.fromarray((np.clip(np.dstack([rgb, a]), 0, 1) * 255).round().astype(np.uint8), 'RGBA').resize((size, size), Image.LANCZOS)
    if background:
        ground = Image.new('RGBA', (size, size), background)
        ground.alpha_composite(im)
        im = ground
    return im


if __name__ == '__main__':
    pub = sys.argv[1]
    if '--blue' in sys.argv[2:]:
        cb.GEM_RAMP = cb.BLUE_RAMP
    with open(f'{pub}/favicon.svg', 'w', encoding='utf-8', newline='\n') as f:
        f.write(svg())
    raster(512).save(f'{pub}/logo.png', optimize=True)
    raster(512).save(f'{pub}/icons/icon-512.png', optimize=True)
    raster(192).save(f'{pub}/icons/icon-192.png', optimize=True)
    raster(512, 0.72, DARK).save(f'{pub}/icons/maskable-512.png', optimize=True)  # within the maskable safe zone (80 %)
    raster(192, 0.72, DARK).save(f'{pub}/icons/maskable-192.png', optimize=True)
    raster(180, 1.12, DARK).save(f'{pub}/icons/apple-touch-icon.png', optimize=True)
    print(pub)
