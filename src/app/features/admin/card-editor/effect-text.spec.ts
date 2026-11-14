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
  conditions: [
    'una vez por turno',
    'por efecto',
    'por efecto aliado',
    'por efecto o enfrentamiento',
  ],
  keywords: [
    { label: 'Celeridad', key: 'Celeridad' },
    { label: 'Provocar', key: 'Provocar {nivel}' },
    { label: 'Valor', key: 'Valor X' },
    { label: 'Furia', key: 'Furia' },
    { label: 'Furia', key: 'Furia {gemas}' },
    { label: 'Protección', key: 'Protección {condición}' },
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

  it('takes keywords inside the text in any case, printed with their capital', () => {
    const l = splitPieces([{ t: 'text', text: 'en invocacion gana celeridad y Valor.' }], cat);
    expect(show(l)).toBe('<En Invocación> gana <Celeridad> y <Valor>.');
  });

  it('joins a condition typed in parts into the longer one', () => {
    const first = splitPieces([{ t: 'text', text: 'en mano por efecto ' }], cat);
    expect(show(first)).toBe('<En Mano> <por efecto> ');
    const more = splitPieces([...first, { t: 'text', text: 'o enfrentamiento ' }], cat);
    expect(show(more)).toBe('<En Mano> <por efecto o enfrentamiento> ');
  });

  it('keeps pieces apart from the text the editor puts right after them', () => {
    const l = splitPieces(
      [
        { t: 'piece', kind: 'timing', label: 'En Mano' },
        { t: 'piece', kind: 'condition', label: 'una vez por turno' },
        { t: 'text', text: 'entre copias: gana' },
        { t: 'piece', kind: 'keyword', label: 'Furia', key: 'Furia' },
        { t: 'text', text: '2.' },
      ],
      cat,
      true,
    );
    expect(show(l)).toBe('<En Mano> <una vez por turno> entre copias: gana <Furia> 2.');
  });

  it('picks the keyword form by its value and reads [[Key:value]] as typed', () => {
    const keyOf = (text: string) =>
      splitPieces([{ t: 'text', text }], cat, true).find((s) => s.t === 'piece')!;
    expect(keyOf('furia 2')).toMatchObject({ label: 'Furia', key: 'Furia {gemas}' });
    expect(keyOf('furia')).toMatchObject({ label: 'Furia', key: 'Furia' });
    expect(keyOf('protección [Dragón]')).toMatchObject({ key: 'Protección {condición}' });
    const l = splitPieces([{ t: 'text', text: 'gana [[Furia {gemas}: 1]] hoy' }], cat, true);
    expect(show(l)).toBe('gana <Furia> 1 hoy');
    expect(linesToEffects([splitPieces([{ t: 'text', text: 'furia 2' }], cat, true)])).toEqual({
      effects: [],
      keywords: [{ keyword: 'Furia {gemas}', number: '2' }],
    });
  });

  it('splits condition and resolution outside inline keywords, and drops a condition piece colon', () => {
    const typed = splitPieces(
      [
        {
          t: 'text',
          text: 'en invocacion una vez por turno entre copias: gana celeridad y furia 1.',
        },
      ],
      cat,
      true,
    );
    expect(linesToEffects([typed]).effects[0].effectBlocks).toEqual([
      { resolution: 'gana [[Celeridad]] y [[Furia {gemas}:1]].' },
    ]);
    const piece = splitPieces(
      [{ t: 'text', text: 'en mano por efecto: roba 1 carta.' }],
      cat,
      true,
    );
    expect(linesToEffects([piece]).effects[0].effectBlocks).toEqual([
      { activationCondition: 'por efecto', resolution: 'roba 1 carta.' },
    ]);
  });

  it('closes "entre copias" with a colon, or a comma when a condition follows', () => {
    const once = (cond: string) =>
      show(
        effectsToLines(
          [
            {
              instance: 'En Mano',
              ussageLimit: 'once per turn between copies',
              effectBlocks: [{ activationCondition: cond, resolution: 'roba 1 carta.' }],
            },
          ],
          [],
          cat,
        )[0],
      );
    expect(once('')).toBe('<En Mano> <una vez por turno> entre copias: roba 1 carta.');
    expect(once('por efecto')).toBe(
      '<En Mano> <una vez por turno> entre copias, <por efecto> roba 1 carta.',
    );
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
