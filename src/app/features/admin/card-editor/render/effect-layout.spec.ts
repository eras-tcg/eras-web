import {
  EffectTokens,
  Token,
  cmykStops,
  keywordReminder,
  layoutAt,
  layoutFit,
  pieceKey,
} from './effect-layout';
import { PieceTable } from './spec.model';

const style = {
  label: '',
  fill: [[0, '#000']] as [number, string][],
  text: '#fff',
  textStroke: null,
  textStrokeSize: null,
};
const pieces: PieceTable = {
  timings: { 'en invocacion': style },
  conditions: { 'por efecto': style, 'una vez por turno': style },
  keywords: { celeridad: style },
};
const ref = {
  Celeridad: { displayText: 'cuando esta carta es invocada: puede subir a tu línea frontal.' },
  'Provocar {nivel}': {
    effect: {
      effectBlocks: [
        {
          activationCondition: 'al entrar al paso de bloqueo',
          cost: 'puedes elegir 1 enemigo nivel {nivel} o menor',
          resolution: 'debe declarar bloqueo si puede.',
        },
      ],
    },
  },
};
const text = (tokens: Token[]) =>
  tokens
    .map((t) =>
      t.t === 'word'
        ? t.text
        : t.t === 'space'
          ? ' '
          : t.t === 'piece'
            ? `<${t.label}>`
            : t.t === 'break'
              ? ' | '
              : '[ED]',
    )
    .join('');

describe('effect-layout', () => {
  const tokens = new EffectTokens(pieces, ref);

  it('keys pieces without accents', () => {
    expect(pieceKey('En Invocación')).toBe('en invocacion');
  });

  it('writes a keyword reminder from its effect', () => {
    expect(keywordReminder('Provocar {nivel}', 4, ref)).toBe(
      'al entrar al paso de bloqueo: puedes elegir 1 enemigo nivel 4 o menor; debe declarar bloqueo si puede.',
    );
  });

  it('drops the heading of a reference text', () => {
    expect(
      keywordReminder('Celeridad', null, {
        Celeridad: {
          displayText:
            '<Todos Los Turnos> [una vez por turno] cuando esta carta es invocada: sube.',
        },
      }),
    ).toBe('cuando esta carta es invocada: sube.');
  });

  it('builds Albigio: keyword, then momento + condición piece + keyword gained', () => {
    const t = tokens.slot(
      [
        {
          instance: 'En Invocación',
          effectBlocks: [
            { activationCondition: 'por efecto', cost: '', resolution: '[[Celeridad]].' },
          ],
        },
      ],
      [{ keyword: 'Provocar {nivel}', number: '4' }],
    );
    expect(text(t)).toBe(
      '<Provocar 4> (al entrar al paso de bloqueo: puedes elegir 1 enemigo nivel 4 o menor; debe declarar bloqueo si puede.) | ' +
        '<En Invocación> <por efecto> <Celeridad>. (Celeridad: cuando esta carta es invocada: puede subir a tu línea frontal.)',
    );
  });

  it('keeps a condition that brings its colon and writes "1 vez"', () => {
    const t = tokens.effect({
      instance: 'En Invocación',
      effectBlocks: [
        { activationCondition: '', cost: '', resolution: 'roba 1 carta.' },
        { activationCondition: 'Luego:', cost: '', resolution: 'tributa 1 carta.' },
      ],
    });
    expect(text(t)).toBe('<En Invocación> roba 1 carta. Luego: tributa 1 carta.');
    const ref = { Letalidad: { displayText: 'hace daño {n} veces más.' } };
    expect(keywordReminder('Letalidad {n}', 1, ref)).toBe('hace daño 1 vez más.');
    expect(keywordReminder('Letalidad {n}', 2, ref)).toBe('hace daño 2 veces más.');
  });

  it('drops the bound of a keyword printed without its value', () => {
    expect(keywordReminder('Provocar {nivel}', null, ref)).toBe(
      'al entrar al paso de bloqueo: puedes elegir 1 enemigo; debe declarar bloqueo si puede.',
    );
  });

  it('writes conditions, costs and usage limits', () => {
    const t = tokens.effect({
      instance: 'Turno Aliado>En Mano',
      ussageLimit: 'once per turn between copies',
      effectBlocks: [
        {
          activationCondition: 'si un aliado es destruido',
          cost: 'puedes tributar 1 carta',
          resolution: 'roba 1 carta.',
        },
      ],
    });
    expect(text(t)).toBe(
      '<Turno Aliado><En Mano> <una vez por turno> entre copias, si un aliado es destruido: puedes tributar 1 carta; roba 1 carta.',
    );
    expect(
      text(
        tokens.effect({
          ussageLimit: 'ultimate effect',
          effectBlocks: [{ resolution: 'gana 1 gema.' }],
        }),
      ),
    ).toBe('[ED] gana 1 gema.');
  });

  it('draws a momento quoted in the text as its piece', () => {
    const withMomento = new EffectTokens({ ...pieces, timings: { 'en destruccion': { ...style, label: 'En Destrucción' } } }, ref);
    const toks = withMomento.slot(
      [{ effectBlocks: [{ resolution: 'otro aliado gana: «En Destrucción puedes robar 1».' }] }],
      [],
    );
    const i = toks.findIndex((t) => t.t === 'piece' && t.kind === 'timing');
    expect(toks[i]).toEqual({ t: 'piece', kind: 'timing', label: 'En Destrucción' });
    expect(toks[i - 1]).toEqual({ t: 'word', text: '«', italic: false });
    expect(toks[i + 1]).toEqual({ t: 'space' });
    // A word that only starts like a momento stays a word
    const none = withMomento.slot([{ effectBlocks: [{ resolution: 'gana «En Destrucciones».' }] }], []);
    expect(none.some((t) => t.t === 'piece' && t.kind === 'timing')).toBe(false);
  });

  it('shrinks the text until it fits', () => {
    const many = tokens.slot(
      [{ effectBlocks: [{ resolution: 'palabra '.repeat(60).trim() }] }],
      [],
    );
    const measure = (t: string, font: string) =>
      t.length * Number(/(\d+(?:\.\d+)?)px/.exec(font)![1]) * 0.5;
    const big = layoutFit(many, 660, 2000, measure);
    const small = layoutFit(many, 660, 200, measure);
    expect(big.pt).toBe(7);
    expect(small.pt).toBeLessThan(7);
  });

  it('fits a text when the letters of its last line are inside the box, as Photoshop does', () => {
    const measure = (t: string, font: string) => t.length * Number(/(\d+(?:\.\d+)?)px/.exec(font)![1]) * 0.5;
    const text = tokens.slot([{ effectBlocks: [{ resolution: 'palabra '.repeat(40).trim() }] }], []);
    const at6 = layoutAt(text, 660, 10_000, 6, measure);
    const lines = at6.lines.length;
    // Room for the lines but the last one's leading below its letters: still 6 pt
    const room = at6.lineHeights.slice(0, -1).reduce((a, b) => a + b, 0) + at6.px * (0.715 + 0.212);
    expect(lines).toBeGreaterThan(1);
    expect(layoutAt(text, 660, room, 6, measure).fits).toBe(true);
    expect(layoutAt(text, 660, room - 1, 6, measure).fits).toBe(false);
  });

  it('blends gradient stops in CMYK when they carry it', () => {
    // Black K100 to cyan C100: the middle is C50 K50, darker than the RGB middle of #000 and #0ff.
    const stops = cmykStops(
      [
        [0, '#000000', [0, 0, 0, 100]],
        [1, '#00ffff', [100, 0, 0, 0]],
      ],
      2,
    );
    expect(stops).toEqual([
      [0, '#000000'],
      [0.5, '#408080'],
      [1, '#00ffff'],
    ]);
    expect(
      cmykStops([
        [0, '#111111'],
        [1, '#222222'],
      ]),
    ).toEqual([
      [0, '#111111'],
      [1, '#222222'],
    ]);
  });
});
