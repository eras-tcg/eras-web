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


def vortex(size, accent='#f5b301', fade_out=(0.6, 1.0), n_arms=3):
    """`accent`: the faint edge on one arm. `n_arms`: how many arms. `fade_out`: where (radius, 0..1 at the square's edge) it fades out to clear."""
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    x, y = (xs + 0.5) / size * 2 - 1, (ys + 0.5) / size * 2 - 1
    r = np.hypot(x, y) + 1e-6
    a = np.arctan2(y, x)
    lr = np.log(r)

    # Two spirals with different twist and arm count: their beat gives the field depth instead of a regular pattern
    s1 = a + 2.6 * lr
    s2 = -a * 1 + 1.4 * lr + 0.9
    arms = 0.5 + 0.5 * np.cos(n_arms * s1)     # the main arms
    arms = arms ** 1.8
    mist = 0.5 + 0.5 * np.cos(2 * s2 + 0.6 * np.sin(5 * s1))
    gold_edge = smooth(0.80, 0.97, 0.5 + 0.5 * np.cos(n_arms * s1 - 0.55)) * smooth(0.3, 0.45, r) * (1 - smooth(0.6, 0.88, r))
    gold_edge *= 0.5 + 0.5 * np.cos(s1)        # on one arm more than the others

    night = rgb('#080a16')
    deep = rgb('#0d1b4a')
    blue = rgb('#1d4ed8')
    violet = rgb('#5b21b6')
    ice = rgb('#93c5fd')
    gold = rgb(accent)

    # Arms run blue→violet along the spiral; mist fills between them with deep blue
    # (whole multiples of the angle only: anything else leaves a seam where the angle wraps around)
    hue = 0.5 + 0.5 * np.sin(s1 + 0.4)
    arm_color = blue * (1 - hue[..., None]) + violet * hue[..., None]
    col = night + (deep - night) * (mist[..., None] * 0.9)
    col = col + (arm_color - col) * (arms[..., None] * 0.85)
    # Near the eye the arms brighten into ice blue, then the eye itself goes dark
    rim = smooth(0.2, 0.3, r) * (1 - smooth(0.3, 0.55, r))
    col = col + (ice - col) * (rim * (0.35 + 0.5 * arms))[..., None]
    eye = 1 - smooth(0.12, 0.26, r)  # under the gem
    col = col + (night - col) * (eye * 0.92)[..., None]
    col = col + (gold - col) * (gold_edge * 0.55)[..., None]

    # Transparent at the rim: the slide's own color takes over
    alpha = 1 - smooth(fade_out[0], fade_out[1], r)
    img = np.dstack([np.clip(col, 0, 1), alpha])
    return Image.fromarray((img * 255).round().astype(np.uint8), 'RGBA')


if __name__ == '__main__':
    out = sys.argv[1]
    im = vortex(SIZE * SS).filter(ImageFilter.GaussianBlur(6 * SS)).resize((SIZE, SIZE), Image.LANCZOS)
    im.save(out, 'WEBP', quality=88, method=6)
    print(out, im.size)
