"""The ERAS card back, built by layers (no generated imagery), for the web and the simulator: a black ground; the
color vortex of the home (design/home/build_vortex.py), five arms turned 18°, its dark eye fading out long and its edge
fading into the black in a shape between an oval and the card's rectangle; in its eye the minimal gem «Espiral» (the
gem's faces solid in the gold cards' tones, the table turned, its edges cut out so the vortex shows through); and a
thin frame in the gold cards' still metal, its corners cut and a tab with the gem's table top and bottom. Same size
ratio as the old back (472×660), drawn at 2×.

    python build_cardback.py <out.png> --blue   «Vórtice», the default back (public/images/card-back.png): the gem in ice blue
    python build_cardback.py <out.png>          «Campeón» (public/images/card-backs/campeon.png): the gem in gold
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
SHAPE = 4.5  # the vortex's fade outline: 2 an ellipse, higher nearer the card's rectangle
TWIST = 1.7  # how tightly the arms coil (the home's: 2.6)
ARMS = 5  # the vortex's arms (the home's has 3)
WIDEN = 1.5  # how much the arms widen towards the edge (more: they close over the dark between them)
SHARP = 0.9  # how narrow the arms are where they start, by the gem (the home's 1.8: dark wedges between them there)
MIST = 'flat'  # the deep blue between the arms (build_vortex.vortex mist_mode): even
MIST_AMOUNT = 0.9  # how much of it (lower: the night shows between the arms)
GEM = False  # the ERAS gem, faceted, in the vortex's eye
MINIMAL = True  # instead: the minimal mark «Espiral» (the gem's faces solid, its edges cut out, the table turned)
MARK = 0.24  # the mark's 512 box, as a share of the vortex's size
TURN = 20  # how far the table is turned against the girdle, degrees
BEND = 0.3  # how much the five edges from the table to the girdle bow, as a share of their length
VOID = 22  # the edges' width (cut out, the vortex shows), in the logo's units
# The gem's gold: the gold cards' own tones (their border's, below), from dark gold to white, as a ramp each pixel's
# light picks from
GEM_RAMP = [(0.0, '#4a3005'), (0.18, '#6b4708'), (0.36, '#8a5c0e'), (0.52, '#b9821c'), (0.68, '#e2b13e'), (0.84, '#f3cf62'), (1.0, '#fff6cf')]
FACE_LEVEL = (0.32, 0.78)  # the side faces' light on the ramp, from the face turned from the light to the face turned to it
TABLE_LEVEL = 0.8  # the table's
TONE_LOW, TONE_HIGH = 0.62, 1.18  # the gem's light, from its far rim (bottom right) to where it falls (top left)
BEVEL = 0.35  # how much each face darkens along its cuts
FRAME = True  # a thin gold frame inset from the card's edge: corners cut, a tab with a small table top and bottom
FRAME_INSET = 22  # px at 2×, from the card's edge to the frame's outer edge (it grows inward)
FRAME_WIDTH = 4  # px at 2×
FRAME_CUT = 22  # px at 2×, how much each corner is cut at 45°
TAB = (70, 40, 22)  # px at 2×: the tab's half width where it leaves the line, its half width at its foot, its depth
TAB_GEM = 8  # px at 2×: the radius of the table (a pentagon) in each tab, pointing into the card
CORNER_DIAMOND = 0  # px at 2×: a small diamond inside each cut corner, its half size (0: none)
# The frame's gold, the gold cards' (src/styles/mixins/_card-shine.scss, @mixin gold), still: polished bands at 115°
# repeating every 24% of the card's gradient line, and a glint across the middle
GOLD_STOPS = [(0, '#6b4708'), (0.06, '#b9821c'), (0.10, '#f3cf62'), (0.12, '#fff6cf'), (0.14, '#e2b13e'), (0.20, '#8a5c0e'), (0.24, '#6b4708')]
EYE = (0.02, 0.42)  # the vortex's dark eye: where it starts to clear and where it is clear (radius, 1 at the edge)
EYE_POINTS = 0.0  # how far the eye reaches out between the arms, in sharp points (0: round)
EYE_COLOR = None  # the eye's color (None: the vortex's night, #080a16)
RIM = (0.08, 0.36, 0.8)  # the ice blue round the eye: where it starts, is fullest, is gone (radius, 1 at the edge)
FADE = (0.35, 1.0)  # where the vortex fades into the black: starts, gone (1: the card's edge)
FADE_POWER = 1.0  # the fade's curve (higher: softer, no edge to see)
SPIRAL_TURN = 18.0  # the spiral turned, degrees (its fade stays square to the card)
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


def gold_metal(iw, ih):
    """The gold cards' metal over the whole card (H×W×3 floats), as CSS paints it on a card this size."""
    import math
    a = math.radians(115)
    dx, dy = math.sin(a), -math.cos(a)  # CSS angles: 0° up, clockwise
    L = abs(iw * dx) + abs(ih * dy)  # the gradient line's length
    yy, xx = np.mgrid[0:ih, 0:iw].astype(np.float32)
    t = ((xx - iw / 2) * dx + (yy - ih / 2) * dy) / L + 0.5  # 0..1 along the line
    u = np.mod(t, GOLD_STOPS[-1][0])
    hexc = lambda h: [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    pos = [p for p, _ in GOLD_STOPS]
    rgb = np.stack([np.interp(u, pos, [hexc(c)[ch] for _, c in GOLD_STOPS]) for ch in range(3)], -1)
    glint = np.interp((t - 0.5) / 2.2 + 0.5, [0.40, 0.47, 0.54], [0, 0.9, 0])[..., None]  # 220% wide, bright at 47%
    return (rgb * (1 - glint) + np.array([1.0, 1.0, 245 / 255], np.float32) * glint).astype(np.float32)


def spiral_parts():
    """The «Espiral» mark in the logo's 512 units: the table (turned by TURN) and the five side faces bounded by the
    five bowed edges from the table's corners to the girdle, plus those edges as strokes (the cuts)."""
    import math
    c = geo.C
    pt = lambda r, deg: (c[0] + r * math.cos(math.radians(deg)), c[1] - r * math.sin(math.radians(deg)))
    table = [pt(geo.r, 90 + 72 * k - TURN) for k in range(5)]
    edges = []
    for k in range(5):
        a, b = table[k], geo.D[2 * k]
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        q = (mid[0] - (b[1] - a[1]) * BEND, mid[1] + (b[0] - a[0]) * BEND)
        edges.append([((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * q[0] + t * t * b[0],
                       (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * q[1] + t * t * b[1]) for t in np.linspace(0, 1, 40)])
    faces = [edges[k] + [geo.D[(2 * k + 1) % 10], geo.D[(2 * k + 2) % 10]] + edges[(k + 1) % 5][::-1] for k in range(5)]
    strokes = edges + [[table[k], table[(k + 1) % 5]] for k in range(5)]
    return table, faces, strokes


def face_light(poly):
    """How much a face turns to the light (top left), 0..1, by its centroid's direction."""
    import math
    x = sum(p[0] for p in poly) / len(poly) - geo.C[0]
    y = sum(p[1] for p in poly) / len(poly) - geo.C[1]
    return (math.cos(math.atan2(-y, x) - geo.LIGHT) + 1) / 2


def minimal_gem(scene, size):
    """The «Espiral» mark over `scene` (H×W×4 floats), centered, `size` across (the logo's 512 box): flat gold faces,
    each by how it turns to the light, the palest on the table; the edges cut out, showing the vortex."""
    ih, iw = scene.shape[:2]
    ss = 4
    k = size / 512 * ss
    ox, oy = (iw - size) / 2 * ss, (ih - size) / 2 * ss
    to = lambda p: (ox + p[0] * k, oy + p[1] * k)
    table, faces, strokes = spiral_parts()

    def raster(draw_fn):
        m = Image.new('L', (iw * ss, ih * ss), 0)
        draw_fn(ImageDraw.Draw(m))
        return np.asarray(m.resize((iw, ih), Image.LANCZOS), np.float32)[..., None] / 255

    def cuts(d):
        r = VOID / 2 * k
        for line in strokes:
            pts = [to(p) for p in line]
            for (x1, y1), (x2, y2) in zip(pts, pts[1:]):  # each piece a band of the edge's width...
                L = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5 or 1
                nx, ny = -(y2 - y1) / L * r, (x2 - x1) / L * r
                d.polygon([(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)], fill=255)
            for x, y in pts:
                d.ellipse((x - r, y - r, x + r, y + r), fill=255)  # ...and a disc at every joint, so it bends clean

    cut = raster(cuts)
    rgb = scene[..., :3]

    # Tonal light over the whole gem, not flat: a broad glow from the top left of the table, falling off to a warm
    # shadow at the far rim; each face darker along its cuts (a soft bevel), and a bright heart on the table
    yy, xx = np.mgrid[0:ih, 0:iw].astype(np.float32)
    rad = size * 200 / 512  # the girdle's radius, px
    u, v = (xx - iw / 2) / rad, (yy - ih / 2) / rad  # the gem's own units: the girdle at 1
    lx, ly = -0.35, -0.4  # where the light falls brightest
    light = np.clip(1 - np.hypot(u - lx, v - ly) / 1.9, 0, 1)[..., None] ** 1.3
    bevel = blur(cut, rad * 0.06)  # near a cut: shadow
    shade = (TONE_LOW + (TONE_HIGH - TONE_LOW) * light) * (1 - bevel * BEVEL)
    heart = np.clip(1 - np.hypot(u, v) / (geo.r / 200 * 0.9), 0, 1)[..., None] ** 1.6

    hexc = lambda h: [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    pos = [p for p, _ in GEM_RAMP]
    ramp = lambda val: np.stack([np.interp(val[..., 0], pos, [hexc(c)[ch] for _, c in GEM_RAMP]) for ch in range(3)], -1)
    lo, hi = FACE_LEVEL
    pieces = [(table, TABLE_LEVEL, True)] + [(f, lo + (hi - lo) * face_light(f), False) for f in faces]
    cover = np.zeros((ih, iw, 1), np.float32)
    for poly, level, is_table in pieces:
        m = raster(lambda d, poly=poly: d.polygon([to(p) for p in poly], fill=255)) * (1 - cut)
        cover = cover + m
        val = level * shade
        if is_table:  # the table glows from its heart (white) to its own gold at the edges
            val = val + (1 - val) * heart
        col = ramp(np.clip(val, 0, 1))
        rgb = rgb * (1 - m) + np.clip(col, 0, 1) * m
    scene[..., :3] = rgb
    scene[..., 3:] = np.maximum(scene[..., 3:], np.clip(cover, 0, 1))  # on a clear scene: the gem alone (the icons)
    return scene


def frame(scene):
    """A thin line of the gold cards' metal inset from the card's edge: its corners cut at 45° (as a gem's), and in the
    middle of its top and bottom a tab dipping into the card with the gem's table in it, pointing to the centre."""
    import math
    ih, iw = scene.shape[:2]
    ss = 4
    m = Image.new('L', (iw * ss, ih * ss), 0)
    d = ImageDraw.Draw(m)
    w = FRAME_WIDTH
    o, c = FRAME_INSET + w / 2, FRAME_CUT  # the line's middle

    def stroke(pts, closed=False):
        pts = [(x * ss, y * ss) for x, y in pts] + ([(pts[0][0] * ss, pts[0][1] * ss)] if closed else [])
        d.line(pts, fill=255, width=round(w * ss), joint='curve')
        r = w * ss / 2
        for x, y in pts:  # every joint and end round, so the corners close clean
            d.ellipse((x - r, y - r, x + r, y + r), fill=255)

    stroke([(o + c, o), (iw - o - c, o), (iw - o, o + c), (iw - o, ih - o - c), (iw - o - c, ih - o), (o + c, ih - o),
            (o, ih - o - c), (o, o + c)], closed=True)
    if CORNER_DIAMOND:  # a small diamond inside each cut corner, on its diagonal
        k = CORNER_DIAMOND
        for cx, cy in ((o + c, o + c), (iw - o - c, o + c), (o + c, ih - o - c), (iw - o - c, ih - o - c)):
            d.polygon([(cx * ss, (cy - k) * ss), ((cx + k) * ss, cy * ss), (cx * ss, (cy + k) * ss), ((cx - k) * ss, cy * ss)], fill=255)
    out, foot, depth = TAB
    for y, s in ((o, 1), (ih - o, -1)):  # top tab dips down, bottom tab up
        cx = iw / 2
        stroke([(cx - out, y), (cx - foot, y + depth * s), (cx + foot, y + depth * s), (cx + out, y)])
        gy = y + depth * 0.5 * s  # midway into the tab
        rot = 270 if s > 0 else 90  # pointing into the card
        d.polygon([((cx + TAB_GEM * math.cos(math.radians(rot + 72 * k))) * ss, (gy - TAB_GEM * math.sin(math.radians(rot + 72 * k))) * ss)
                   for k in range(5)], fill=255)
    m = np.asarray(m.resize((iw, ih), Image.LANCZOS), np.float32)[..., None] / 255
    scene[..., :3] = scene[..., :3] * (1 - m) + gold_metal(iw, ih) * m
    return scene


def cardback():
    w, h = W * K, H * K
    iw, ih = w, h
    inner = Image.new('RGBA', (iw, ih), NIGHT)

    # Vortex: square, a bit taller than the card's face, fading into the black ground evenly towards the card's edges
    # (box: the same for every arm, whichever side it leaves by); its accent a light blue of the palette
    vs = round(ih * 1.15)
    box = (iw / vs, ih / vs)  # the card's half sizes in the vortex's units: every arm widens up to the card's edge
    vortex = v.vortex(vs * 2, accent=ACCENT, fade_out=FADE, n_arms=ARMS, taper=True, twist=TWIST, box=box, shape=SHAPE, eye=EYE, eye_points=EYE_POINTS, eye_color=EYE_COLOR, widen=WIDEN, mist_mode=MIST, mist_amount=MIST_AMOUNT, sharp=SHARP, rim=RIM, fade_power=FADE_POWER, turn=SPIRAL_TURN).filter(ImageFilter.GaussianBlur(6 * 2 * vs / 2048)).resize((vs, vs), Image.LANCZOS)
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
        inner = Image.fromarray((np.clip(minimal_gem(arr(inner), round(vs * MARK)), 0, 1) * 255).round().astype(np.uint8), 'RGBA')

    if FRAME:
        inner = Image.fromarray((np.clip(frame(arr(inner)), 0, 1) * 255).round().astype(np.uint8), 'RGBA')

    card = inner
    return card.convert('RGB')


# «Vórtice», the default back: the same with the gem in ice blue tones (the palette's light blue, the vortex's accent)
# instead of the gold cards' («Campeón»); the frame stays gold
BLUE_RAMP = [(0.0, '#06183a'), (0.18, '#0b2a5c'), (0.36, '#124283'), (0.52, '#1c68b4'), (0.68, '#38a4e8'), (0.84, '#7dd3fc'), (1.0, '#effaff')]


if __name__ == '__main__':
    out = sys.argv[1]
    if '--blue' in sys.argv[2:]:
        GEM_RAMP = BLUE_RAMP
    cardback().save(out, optimize=True)
    print(out)
