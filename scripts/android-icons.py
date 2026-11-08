"""Android app icons and splash from the site's artwork (public/icons): run from eras-web after changing the art.

    python3 scripts/android-icons.py

Writes android/app/src/main/res: the launcher icon (adaptive: the dodecahedron on the dark background of the
maskable icon; legacy square and round PNGs for Android 7) and the splash logo. Needs Pillow.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'android/app/src/main/res'
ART = Image.open(ROOT / 'public/icons/icon-512.png').convert('RGBA')
BACKGROUND = (20, 20, 20, 255)  # the maskable icon's background (#141414)
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def centered(size: int, art_fraction: float, background=(0, 0, 0, 0)) -> Image.Image:
    """The art, art_fraction of the canvas wide, centred on a size x size canvas."""
    canvas = Image.new('RGBA', (size, size), background)
    art = ART.crop(ART.getbbox())
    scale = size * art_fraction / max(art.size)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


for name, d in DENSITIES.items():
    folder = RES / f'mipmap-{name}'
    folder.mkdir(parents=True, exist_ok=True)
    # Adaptive foreground: 108dp, the art inside the 66dp safe zone
    centered(round(108 * d), 0.56).save(folder / 'ic_launcher_foreground.png', optimize=True)
    legacy = round(48 * d)
    centered(legacy, 0.72, BACKGROUND).save(folder / 'ic_launcher.png', optimize=True)
    round_icon = centered(legacy, 0.66, BACKGROUND)
    mask = Image.new('L', (legacy, legacy), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, legacy - 1, legacy - 1), fill=255)
    round_icon.putalpha(mask)
    round_icon.save(folder / 'ic_launcher_round.png', optimize=True)

nodpi = RES / 'drawable-nodpi'
nodpi.mkdir(parents=True, exist_ok=True)
# Android 12+ splash icon: shown at 240dp, the art within its central 160dp circle
centered(480, 0.6).save(nodpi / 'splash_icon.png', optimize=True)
# Android 7-11 splash (a layer-list draws it centred on the background colour)
centered(320, 1.0).save(nodpi / 'splash_logo.png', optimize=True)
print('icons written to', RES)
