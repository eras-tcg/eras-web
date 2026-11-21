import { foilCutSpec, glossSpec, goldSpec } from './gloss-mask';
import { CardSpec, SpecNode } from './spec.model';

const shape = (name: string, visible = true, bbox = [0, 100, 10, 110]): SpecNode => ({
  name,
  kind: 'shape',
  visible,
  opacity: 0.5,
  bbox,
  paths: [{ d: 'M0 0H10V10H0Z', op: 1 }],
  fill: '#123456',
  fx: { bevel: { size: 2, angle: 90, hi: '#fff', hiOpacity: 1, sh: '#000', shOpacity: 1 } },
});
const LEVEL_BOX = [11, 921, 110, 1020];
const ring = (name: string, bbox = LEVEL_BOX): SpecNode => ({
  ...shape(name, true, bbox),
  fill: undefined,
  stroke: {
    width: 6,
    align: 'strokeStyleAlignInside',
    opacity: 1,
    color: '#c9a227',
    gradient: null,
  },
});
const group = (name: string, children: SpecNode[], visible = true): SpecNode => ({
  name,
  kind: 'group',
  visible,
  opacity: 1,
  bbox: [0, 0, 10, 10],
  children,
});
const names = (nodes: SpecNode[]): string[] =>
  nodes.flatMap((n) => (n.children ? names(n.children) : [n.name]));
const find = (nodes: SpecNode[], name: string): SpecNode | undefined => {
  for (const n of nodes) {
    if (n.name === name) return n;
    const hit = n.children ? find(n.children, name) : undefined;
    if (hit) return hit;
  }
  return undefined;
};

const card = (style: string, her = false): CardSpec & { style: string } => ({
  style,
  width: 744,
  height: 1039,
  layers: [
    { ...shape('Fondo'), paths: undefined, raster: 'data:' },
    group('formas', [
      group('CARD-STRUCTURE', [
        shape('BACK LV', true, [13, 924, 108, 1018]),
        // The black frame has no gloss; the level's ring inside it does (semi and full art)
        group('FRAME', [
          group('remaining FRAME', [
            shape('TOPMARGIN'),
            shape('LEVEL BACKGROUND', true, [9, 921, 110, 1021]),
          ]),
          // The semi full art's black piece under the tab, named as the colored strip
          shape('Rectángulo redondeado 4 copia 6', true, [173, -63, 571, 33]),
          // With inherited effects the badge sits higher (and another ring stays at the bottom, not it)
          ...(her
            ? [ring('circulo interior copia 5', [11, 824, 110, 923])]
            : [ring('circulo interior copia 4')]),
        ]),
        shape('Rectángulo redondeado 4 copia 4', true, [186, -116, 558, 13]),
      ]),
      group('FLOATING-OBJ', [
        shape('COST FRAME'),
        group('remaining', [group('strengthfigure', [shape('circulo interior')])]),
      ]),
    ]),
    group('values', [
      group('COLOR OBJECTS', [
        group('BLUE', [
          shape('Type Frame'),
          her ? shape('left curved side') : shape('br corner'),
          shape('BACK EFFECT'),
        ]),
        group('RED', [shape('Type Frame')], false),
      ]),
      {
        ...shape('LEVEL', true, her ? [45, 859, 75, 888] : [45, 956, 75, 985]),
        paths: undefined,
        text: {
          text: 'III',
          runs: [{ text: 'III', font: 'x', size: 30, color: '#c9a227' }],
          justify: 'center',
          transform: [],
          box: null,
        },
      },
      {
        ...shape('NAME'),
        paths: undefined,
        text: {
          text: 'x',
          runs: [{ text: 'x', font: 'x', size: 20, color: '#fff' }],
          justify: 'left',
          transform: [],
          box: null,
        },
      },
    ]),
    group('Alt Summon', [group('BLUE', [shape('special cost'), shape('Special Summon Frame')])]),
  ],
});

describe('gloss-mask', () => {
  it('keeps the boxes, the top color strip and special cost, in solid white; no frame nor strength', () => {
    const spec = glossSpec(card('standard'));
    expect(names(spec.layers)).toEqual([
      'Rectángulo redondeado 4 copia 4',
      'Type Frame',
      'br corner',
      'NAME',
      'special cost',
      'Special Summon Frame',
    ]);
    expect(find(spec.layers, 'Type Frame')).toMatchObject({
      fill: '#ffffff',
      opacity: 1,
      fillOpacity: 1,
      fx: undefined,
    });
    // The name stays matte: cut out in black
    expect(find(spec.layers, 'NAME')?.text?.runs.every((r) => r.color === '#000000')).toBe(true);
  });

  it('adds the strength, the cost and the level (its ring and its number, not its badge) on semi and full art cards', () => {
    for (const style of ['semi', 'full']) {
      const spec = glossSpec(card(style));
      expect(names(spec.layers)).toEqual([
        'circulo interior copia 4',
        'Rectángulo redondeado 4 copia 4',
        'COST FRAME',
        'circulo interior',
        'Type Frame',
        'br corner',
        'LEVEL',
        'NAME',
        'special cost',
        'Special Summon Frame',
      ]);
      expect(find(spec.layers, 'circulo interior copia 4')).toMatchObject({
        fill: null,
        stroke: { color: '#ffffff' },
      });
      expect(find(spec.layers, 'LEVEL')?.text?.runs[0].color).toBe('#ffffff');
    }
  });

  it('finds the level ring where the number is, also higher up on cards with inherited effects', () => {
    const spec = glossSpec(card('semi', true));
    expect(find(spec.layers, 'circulo interior copia 5')).toMatchObject({
      fill: null,
      stroke: { color: '#ffffff' },
    });
    expect(find(spec.layers, 'LEVEL')).toBeDefined();
    // Their name box has another name
    expect(find(spec.layers, 'left curved side')).toMatchObject({ fill: '#ffffff' });
  });

  it('draws the gold border: lines and corners solid, outline and level ring as lines; not its black box nor label', () => {
    const gold = goldSpec({
      width: 744,
      height: 1039,
      layers: [
        group('CARD-STRUCTURE', [
          group('FRAME', [shape('TOPMARGIN')]),
          group('GOLD BORDER', [
            group('BORDER', [
              shape('Rectángulo 33', true, [6, 29, 10, 927]),
              ring('Rectángulo 33 copia 7'),
            ]),
            ring('Elipse 9'),
            { ...shape('Rectángulo 34'), fill: '#000000' },
            {
              ...shape('CARD-TYPE copia'),
              paths: undefined,
              text: { text: 'Criatura', runs: [], justify: 'center', transform: [], box: null },
            },
          ]),
        ]),
      ],
    })!;
    expect(names(gold.layers)).toEqual(['Rectángulo 33', 'Rectángulo 33 copia 7', 'Elipse 9']);
    expect(find(gold.layers, 'Rectángulo 33')).toMatchObject({ fill: '#ffffff' });
    expect(find(gold.layers, 'Elipse 9')).toMatchObject({
      fill: null,
      stroke: { color: '#ffffff' },
    });
  });

  it('gilds the name and the code of a gold card: their letters only', () => {
    const gold = goldSpec({
      width: 744,
      height: 1039,
      layers: [
        group('GOLD BORDER', [shape('Rectángulo 33')]),
        {
          ...shape('NAME'),
          paths: undefined,
          fx: { stroke: { color: '#000000', gradient: null, opacity: 1, size: 3 } },
          text: { text: 'Zombi', runs: [{ text: 'Zombi', color: '#ffffff' }], justify: 'center', transform: [], box: null },
        },
        {
          ...shape('EDITION'),
          paths: undefined,
          text: { text: 'E3-G22 SEC', runs: [{ text: 'E3-G22 SEC', color: '#000000' }], justify: 'right', transform: [], box: null },
        },
      ],
    } as never)!;
    expect(find(gold.layers, 'NAME')).toMatchObject({ fx: undefined, text: { runs: [{ color: '#ffffff' }] } });
    expect(find(gold.layers, 'EDITION')).toMatchObject({ text: { runs: [{ color: '#ffffff' }] } });
  });

  it('has no gold mask for a card without a gold border', () => {
    expect(goldSpec(card('full'))).toBeNull();
    expect(
      goldSpec({ width: 744, height: 1039, layers: [group('GOLD BORDER', [shape('x')], false)] }),
    ).toBeNull();
  });
  it('leaves the glossy parts whole, the effect box and the level out of the foil, on any card', () => {
    const spec = foilCutSpec(card('standard'));
    expect(names(spec.layers)).toEqual([
      'Rectángulo redondeado 4 copia 4',
      'Type Frame',
      'br corner',
      'special cost',
      'Special Summon Frame',
      'BACK LV',
      'LEVEL BACKGROUND',
      'circulo interior copia 4',
      'BACK EFFECT',
      'LEVEL',
    ]);
    expect(find(spec.layers, 'BACK EFFECT')).toMatchObject({ fill: '#ffffff', opacity: 1 });
  });
});
