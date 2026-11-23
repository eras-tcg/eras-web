"""ERAS gem logo, built layer by layer (no generated imagery): the dodecahedron seen face-on, as the current logo, cut
like a gem. Writes one SVG per variant with named layer groups (base, facetas, aristas, brillos, bisel, resplandor).

    python build_gem.py <out_dir>
"""
import math
import sys

R = 200.0          # outer decagon (the gem's girdle)
r = 0.60 * R       # the table (central pentagon)
C = (256.0, 256.0)
LIGHT = math.radians(135)  # light from the top left


def pt(radius, deg):
    a = math.radians(deg)
    return (C[0] + radius * math.cos(a), C[1] - radius * math.sin(a))


P = [pt(r, 90 + 72 * k) for k in range(5)]        # table vertices, pointing up
D = [pt(R, 90 + 36 * j) for j in range(10)]       # girdle vertices
MID = [pt((r + R) / 2 * 0.98, 90 + 72 * k + 36) for k in range(5)]  # centre of each side face


def poly(points):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in points)


def face(k):
    """Side face k: the table's edge P_k–P_k+1 and three girdle vertices."""
    return [P[k], D[2 * k], D[(2 * k + 1) % 10], D[(2 * k + 2) % 10], P[(k + 1) % 5]]


def lit(k):
    """How much side face k faces the light, 0..1."""
    ang = math.radians(90 + 72 * k + 36)
    return (math.cos(ang - LIGHT) + 1) / 2


def mix(a, b, t):
    a = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x + (y - x) * t):02x}' for x, y in zip(a, b))


def gem(name, table, faces, bezel=False, glow='#3b82f6'):
    """table: (light, dark) of the table; faces: per side face (light, dark)."""
    defs, layers = [], []
    # Resplandor: soft light around the gem
    defs.append(f'<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="55%" stop-color="{glow}" stop-opacity="0.45"/>'
                f'<stop offset="100%" stop-color="{glow}" stop-opacity="0"/></radialGradient>')
    layers.append(f'<g id="resplandor"><circle cx="{C[0]}" cy="{C[1]}" r="{R * 1.22:.0f}" fill="url(#glow)"/></g>')
    # Bisel: a gold frame around the girdle
    if bezel:
        defs.append('<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/>'
                    '<stop offset="0.35" stop-color="#f5b301"/><stop offset="0.7" stop-color="#9a6a00"/><stop offset="1" stop-color="#f5c542"/></linearGradient>')
        outer = [pt(R * 1.12, 90 + 36 * j) for j in range(10)]
        layers.append(f'<g id="bisel"><polygon points="{poly(outer)}" fill="url(#gold)"/>'
                      f'<polygon points="{poly([pt(R * 1.035, 90 + 36 * j) for j in range(10)])}" fill="#3a2800" opacity="0.55"/></g>')
    # Base: the girdle's dark silhouette (shows as the thin gaps between facets)
    layers.append(f'<g id="base"><polygon points="{poly(D)}" fill="#0a1426"/></g>')
    # Facetas: each side face with its own light, from its lit corner to its dark one
    facets = []
    for k in range(5):
        light, dark = faces[k]
        t = lit(k)
        a = math.radians(90 + 72 * k + 36)
        # gradient along the light direction across the face
        x1, y1 = 0.5 - 0.5 * math.cos(LIGHT), 0.5 + 0.5 * math.sin(LIGHT)
        defs.append(f'<linearGradient id="f{k}" x1="{x1:.2f}" y1="{y1:.2f}" x2="{1 - x1:.2f}" y2="{1 - y1:.2f}">'
                    f'<stop offset="0" stop-color="{mix(dark, light, 0.35 + 0.65 * t)}"/><stop offset="1" stop-color="{mix(dark, light, 0.15 * t)}"/></linearGradient>')
        facets.append(f'<polygon points="{poly(face(k))}" fill="url(#f{k})"/>')
        # subfacets: a star cut from the face's middle girdle vertex to the table edge's midpoint, for sparkle
        m = ((P[k][0] + P[(k + 1) % 5][0]) / 2, (P[k][1] + P[(k + 1) % 5][1]) / 2)
        g = D[(2 * k + 1) % 10]
        facets.append(f'<polygon points="{poly([P[k], g, m])}" fill="#ffffff" opacity="{0.05 + 0.12 * t:.2f}"/>')
        facets.append(f'<polygon points="{poly([m, g, P[(k + 1) % 5]])}" fill="#000000" opacity="{0.10 + 0.10 * (1 - t):.2f}"/>')
    tl, td = table
    defs.append(f'<radialGradient id="table" cx="38%" cy="32%" r="80%"><stop offset="0" stop-color="{tl}"/><stop offset="1" stop-color="{td}"/></radialGradient>')
    facets.append(f'<polygon points="{poly(P)}" fill="url(#table)"/>')
    # the table's inner star (a smaller pentagon turned 36°), the cut's crown
    inner = [pt(r * 0.42, 90 + 72 * k + 36) for k in range(5)]
    for k in range(5):
        facets.append(f'<polygon points="{poly([P[k], inner[k], P[(k + 1) % 5]])}" fill="#ffffff" opacity="{0.04 + 0.10 * lit(k):.2f}"/>')
    layers.append('<g id="facetas">' + ''.join(facets) + '</g>')
    # Aristas: thin lit edges instead of thick dark outlines
    edges = [f'<polygon points="{poly(P)}" fill="none"/>']
    edges += [f'<line x1="{P[k][0]:.1f}" y1="{P[k][1]:.1f}" x2="{D[2 * k][0]:.1f}" y2="{D[2 * k][1]:.1f}"/>' for k in range(5)]
    edges.append(f'<polygon points="{poly(D)}" fill="none"/>')
    layers.append('<g id="aristas" stroke="#e6f1ff" stroke-opacity="0.55" stroke-width="2.5" stroke-linejoin="round">' + ''.join(edges) + '</g>')
    # Brillos: a specular streak on the table and a spark on the top-left girdle
    s0 = pt(r * 0.78, 90 + 72 * 1 - 10)
    s1 = pt(r * 0.55, 90 + 20)
    s2 = pt(r * 0.20, 130)
    layers.append(f'<g id="brillos"><polygon points="{poly([s0, s1, s2])}" fill="#ffffff" opacity="0.35"/>'
                  f'<circle cx="{D[1][0] + 10:.1f}" cy="{D[1][1] + 8:.1f}" r="5" fill="#ffffff" opacity="0.85"/>'
                  f'<circle cx="{D[1][0] + 10:.1f}" cy="{D[1][1] + 8:.1f}" r="12" fill="#ffffff" opacity="0.18"/></g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">'
            f'<title>ERAS — {name}</title><defs>{"".join(defs)}</defs>{"".join(layers)}</svg>\n')


SAPPHIRE = [('#7cc4ff', '#0b2a5a')] * 5
IDENTITIES = [  # one side face per identity, clockwise from the top left: Azul, Verde, Violeta, Rojo, Blanco
    ('#7cc4ff', '#0b2a5a'),
    ('#7ef0a8', '#0b4a2a'),
    ('#d9a8ff', '#3a1466'),
    ('#ff9a9a', '#5c0f12'),
    ('#ffffff', '#5e6678'),
]

VARIANTS = {
    'gema-zafiro': dict(name='Zafiro', table=('#bfe6ff', '#1d5fa8'), faces=SAPPHIRE),
    'gema-identidades': dict(name='Cinco identidades', table=('#ffffff', '#8aa4c8'), faces=IDENTITIES, glow='#f5b301'),
    'gema-engaste': dict(name='Engaste dorado', table=('#bfe6ff', '#1d5fa8'), faces=SAPPHIRE, bezel=True, glow='#f5b301'),
}

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    for file, v in VARIANTS.items():
        with open(f'{out}/{file}.svg', 'w', encoding='utf-8', newline='\n') as f:
            f.write(gem(**v))
        print(file)
