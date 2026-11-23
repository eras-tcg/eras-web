"""The home carousel's backdrop for slides without cards: a vortex made only of color, no shapes. Each pixel's tone comes
from a logarithmic spiral (angle + twist·ln r), so the bands of color curl in towards a dark eye; deep blue and violet
arms, a lighter blue where they meet the eye, a faint gold edge on one arm. The eye is as wide as the ERAS gem, which
the page sets on it: the arms converge on the gem's edge. Transparent towards the rim, so it melts
into the slide's night blue. The page turns it slowly.

    python build_vortex.py <out.webp>
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

SIZE = 1024
SS = 2


def rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def arm_profile(s1, reach, n_arms, taper, widen=1.5, sharp=1.8):
    """Where the arms are, 0..1, along the spiral phase `s1`, `reach` out (0 at the eye, 1 at the edge). Without
    `taper` each arm takes the same share of the turn everywhere; with it the arms are as they are near the eye and widen
    steadily towards the edge (a softer profile further out); `widen`: how much (1.8 or more: they meet their
    neighbours out there); `sharp`: how narrow they are near the eye (lower: wider, less dark between them there)."""
    c = 0.5 + 0.5 * np.cos(n_arms * s1)
    if not taper:
        return c ** 1.8
    near = 1 - smooth(0.2, 0.45, reach)  # `sharp` only by the eye; further out the arms are as ever
    return c ** np.maximum(1.8 - widen * smooth(0.25, 1.0, reach) - (1.8 - sharp) * near, 0.05)


def box_reach(x, y, box, shape):
    """How far out a point is in a rectangle of half sizes `box` (a superellipse of exponent `shape`): 1 on its edges'
    midpoints, the same wherever an arm leaves it."""
    return ((np.abs(x) / box[0]) ** shape + (np.abs(y) / box[1]) ** shape) ** (1 / shape)


def vortex(size, accent='#f5b301', fade_out=(0.6, 1.0), n_arms=3, taper=False, twist=2.6, box=None, shape=3,
           eye=(0.12, 0.26), eye_points=0.0, eye_color=None, widen=1.5, mist_mode='cross', mist_amount=0.9, sharp=1.8,
           rim=(0.2, 0.3, 0.55), fade_power=1.0, turn=0.0):
    """`accent`: the faint edge on one arm. `n_arms`: how many arms. `fade_out`: where (radius, 0..1 at the square's edge)
    it fades out to clear. `taper`: arms widening towards the rim (arm_profile). `twist`: how tightly the arms coil
    (lower: a more open spiral). `box`: the half sizes (in the square's units) of the rectangle it is shown in: with
    `taper`, every arm then reaches its full width where it meets that rectangle's edge, whichever side it leaves by, and
    all the arms are alike (one color along them by distance, the mist and accent with the arms' symmetry). `eye`: the
    dark eye's radii, where it starts to clear and where it is clear. `eye_points`: how far the eye reaches out between
    the arms, in sharp points that coil with them (0: a round eye). `eye_color`: the eye's color (None: the night's).
    `widen`: how much the tapered arms widen towards the edge (see arm_profile). `mist_mode`: the deep blue between the
    arms: 'cross' coils the other way (where it misses a gap, a dark hole), 'along' follows the gaps, 'flat' even;
    `mist_amount`: how much of it (lower: the night shows between the arms). `sharp`: see arm_profile. `rim`: the ice
    blue where the arms meet the eye: where it starts, where it is fullest, where it is gone (radii). `fade_power`: the
    fade out's curve (higher: it thins sooner and lingers longer, with no edge to see). `turn`: the spiral turned by
    this many degrees, its fade (`box`) still square to the rectangle."""
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    x, y = (xs + 0.5) / size * 2 - 1, (ys + 0.5) / size * 2 - 1
    r = np.hypot(x, y) + 1e-6
    a = np.arctan2(y, x) + np.radians(turn)
    lr = np.log(r)

    # Two spirals with different twist and arm count: their beat gives the field depth instead of a regular pattern
    s1 = a + twist * lr
    s2 = -a * 1 + 1.4 * lr + 0.9
    even = taper and box is not None  # every arm alike (see the docstring)
    reach = box_reach(x, y, box, shape) if even else r
    arms = arm_profile(s1, reach, n_arms, taper, widen, sharp)  # the main arms
    if mist_mode == 'along':  # brightest midway between two arms, along the whole gap
        mist = 0.5 - 0.5 * np.cos(n_arms * s1)
    elif mist_mode == 'flat':
        mist = np.full_like(r, 0.5)
    else:
        mist = 0.5 + 0.5 * np.cos((n_arms if even else 2) * s2 + 0.6 * np.sin(5 * s1))
    gold_edge = smooth(0.80, 0.97, 0.5 + 0.5 * np.cos(n_arms * s1 - 0.55)) * smooth(0.3, 0.45, r) * (1 - smooth(0.6, 0.88, reach))
    if not even:
        gold_edge *= 0.5 + 0.5 * np.cos(s1)    # on one arm more than the others

    night = rgb('#080a16')
    deep = rgb('#0d1b4a')
    blue = rgb('#1d4ed8')
    violet = rgb('#5b21b6')
    ice = rgb('#93c5fd')
    gold = rgb(accent)

    # Arms run blue→violet along the spiral; mist fills between them with deep blue
    # (whole multiples of the angle only: anything else leaves a seam where the angle wraps around)
    # (even: blue near the eye to violet out, the same on every arm)
    hue = smooth(0.3, 1.0, reach) if even else 0.5 + 0.5 * np.sin(s1 + 0.4)
    arm_color = blue * (1 - hue[..., None]) + violet * hue[..., None]
    col = night + (deep - night) * (mist[..., None] * mist_amount)
    col = col + (arm_color - col) * (arms[..., None] * 0.85)
    # Near the eye the arms brighten into ice blue, then the eye itself goes dark
    rim = smooth(rim[0], rim[1], r) * (1 - smooth(rim[1], rim[2], r))
    col = col + (ice - col) * (rim * (0.35 + 0.5 * arms))[..., None]
    gap = (1 - (0.5 + 0.5 * np.cos(n_arms * s1))) ** 4  # 1 midway between two arms, falling fast towards them
    eye = 1 - smooth(eye[0], eye[1], r / (1 + eye_points * gap))  # under the gem
    col = col + ((rgb(eye_color) if eye_color else night) - col) * (eye * 0.92)[..., None]
    col = col + (gold - col) * (gold_edge * 0.55)[..., None]

    # Transparent at the rim: the slide's own color takes over
    alpha = (1 - smooth(fade_out[0], fade_out[1], reach)) ** fade_power
    img = np.dstack([np.clip(col, 0, 1), alpha])
    return Image.fromarray((img * 255).round().astype(np.uint8), 'RGBA')


if __name__ == '__main__':
    out = sys.argv[1]
    im = vortex(SIZE * SS).filter(ImageFilter.GaussianBlur(6 * SS)).resize((SIZE, SIZE), Image.LANCZOS)
    im.save(out, 'WEBP', quality=88, method=6)
    print(out, im.size)
