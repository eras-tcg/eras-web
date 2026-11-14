import {
  Line,
  PieceCatalog,
  effectsToLines,
  foldChars,
  linesToEffects,
  splitPieces,
} from './effect-text';

const cat: PieceCatalog = {
  timings: ['En Invocación', 'Turno Aliado', 'En Mano', 'Todos Los Turnos'],
  conditions: ['una vez por turno', 'por efecto', 'por efecto aliado'],
  keywords: [
    { label: 'Celeridad', key: 'Celeridad' },
    { label: 'Provocar', key: 'Provocar {nivel}' },
    { label: 'Valor', key: 'Valor X' },
  ],
};
const show = (l: Line) => l.map((s) => (s.t === 'text' ? s.text : `<${s.label}>`)).join('');

describe('effect-text', () => {
  it('folds accents without moving positions', () => {
    expect(foldChars('En Invocación')).toBe('en invocacion');
  });

  it('turns typed momentos and conditions at the start into pieces', () => {
    const typed: Line = [
      {
        t: 'text',
        text: 'turno aliado en mano una vez por turno entre copias, si un aliado es invocado por efecto: roba',
      },
    ];
    expect(show(splitPieces(typed, cat))).toBe(
      '<Turno Aliado> <En Mano> <una vez por turno> entre copias, si un aliado es invocado por efecto: roba',
    );
  });

  it('waits for a space before replacing, unless final', () => {
    expect(show(splitPieces([{ t: 'text', text: 'en mano' }], cat))).toBe('en mano');
    expect(show(splitPieces([{ t: 'text', text: 'en mano' }], cat, true))).toBe('<En Mano>');
    expect(show(splitPieces([{ t: 'text', text: 'en manos ' }], cat))).toBe('en manos ');
  });

  it('takes keywords inside the text only when capitalized', () => {
    const l = splitPieces([{ t: 'text', text: 'en invocacion gana Celeridad y valor.' }], cat);
    expect(show(l)).toBe('<En Invocación> gana <Celeridad> y valor.');
  });

  it('converts lines to effects and keywords', () => {
    const lines = [
      splitPieces([{ t: 'text', text: 'provocar 4' }], cat, true),
      splitPieces([{ t: 'text', text: 'en invocacion por efecto gana Celeridad.' }], cat, true),
      splitPieces(
        [
          {
            t: 'text',
            text: 'turno aliado una vez por turno entre copias, si X: tributa 1; roba 1.',
          },
        ],
        cat,
        true,
      ),
    ];
    const { effects, keywords } = linesToEffects(lines);
    expect(keywords).toEqual([{ keyword: 'Provocar {nivel}', number: '4' }]);
    expect(effects[0]).toEqual({
      instance: 'En Invocación',
      effectBlocks: [{ activationCondition: 'por efecto', resolution: 'gana [[Celeridad]].' }],
    });
    expect(effects[1]).toEqual({
      instance: 'Turno Aliado',
      ussageLimit: 'once per turn between copies',
      effectBlocks: [{ activationCondition: 'si X', cost: 'tributa 1', resolution: 'roba 1.' }],
    });
  });

  it('round-trips metadata through lines', () => {
    const effects = [
      {
        instance: 'Turno Aliado>En Mano',
        ussageLimit: 'once per turn between copies',
        effectBlocks: [
          {
            activationCondition: 'si un aliado es destruido',
            cost: 'puedes tributar 1 carta',
            resolution: 'gana [[Valor X:2]].',
          },
        ],
      },
      { ussageLimit: 'ultimate effect', effectBlocks: [{ resolution: 'roba 2.' }] },
    ];
    const keywords = [{ keyword: 'Provocar {nivel}', number: '3' }];
    const lines = effectsToLines(effects, keywords, cat);
    expect(lines.map(show)).toEqual([
      '<Provocar> 3',
      '<Turno Aliado> <En Mano> <una vez por turno> entre copias, si un aliado es destruido: puedes tributar 1 carta; gana <Valor> 2.',
      '<Efecto Definitivo> roba 2.',
    ]);
    const back = linesToEffects(lines);
    expect(back.keywords).toEqual(keywords);
    expect(back.effects).toEqual(effects);
  });

  it('keeps the head open after "entre copias,"', () => {
    const l = splitPieces(
      [{ t: 'text', text: 'turno aliado una vez por turno entre copias, por efecto gana 1.' }],
      cat,
    );
    expect(show(l)).toBe('<Turno Aliado> <una vez por turno> entre copias, <por efecto> gana 1.');
    const { effects } = linesToEffects([l]);
    expect(effects[0].ussageLimit).toBe('once per turn between copies');
    expect(effects[0].effectBlocks?.[0]).toEqual({
      activationCondition: 'por efecto',
      resolution: 'gana 1.',
    });
  });
});
