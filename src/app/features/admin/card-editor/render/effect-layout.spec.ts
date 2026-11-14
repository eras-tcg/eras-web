import { EffectTokens, Token, keywordReminder, layoutFit, pieceKey } from './effect-layout';
import { PieceTable } from './spec.model';

const style = { label: '', fill: [[0, '#000']] as [number, string][], text: '#fff', textStroke: null, textStrokeSize: null };
const pieces: PieceTable = { timings: { 'en invocacion': style }, conditions: { 'por efecto': style, 'una vez por turno': style }, keywords: { celeridad: style } };
const ref = {
  Celeridad: { displayText: 'cuando esta carta es invocada: puede subir a tu línea frontal.' },
  'Provocar {nivel}': { effect: { effectBlocks: [{ activationCondition: 'al entrar al paso de bloqueo', cost: 'puedes elegir 1 enemigo nivel {nivel} o menor', resolution: 'debe declarar bloqueo si puede.' }] } },
};
const text = (tokens: Token[]) =>
  tokens.map((t) => (t.t === 'word' ? t.text : t.t === 'space' ? ' ' : t.t === 'piece' ? `<${t.label}>` : t.t === 'break' ? ' | ' : '[ED]')).join('');

describe('effect-layout', () => {
  const tokens = new EffectTokens(pieces, ref);

  it('keys pieces without accents', () => {
    expect(pieceKey('En Invocación')).toBe('en invocacion');
  });

  it('writes a keyword reminder from its effect', () => {
    expect(keywordReminder('Provocar {nivel}', 4, ref)).toBe('al entrar al paso de bloqueo: puedes elegir 1 enemigo nivel 4 o menor; debe declarar bloqueo si puede.');
  });

  it('drops the heading of a reference text', () => {
    expect(keywordReminder('Celeridad', null, { Celeridad: { displayText: '<Todos Los Turnos> [una vez por turno] cuando esta carta es invocada: sube.' } })).toBe(
      'cuando esta carta es invocada: sube.',
    );
  });

  it('builds Albigio: keyword, then momento + condición piece + keyword gained', () => {
    const t = tokens.slot(
      [{ instance: 'En Invocación', effectBlocks: [{ activationCondition: 'por efecto', cost: '', resolution: '[[Celeridad]].' }] }],
      [{ keyword: 'Provocar {nivel}', number: '4' }],
    );
    expect(text(t)).toBe(
      '<Provocar 4> (al entrar al paso de bloqueo: puedes elegir 1 enemigo nivel 4 o menor; debe declarar bloqueo si puede.) | ' +
        '<En Invocación> <por efecto> <Celeridad>. (Celeridad: cuando esta carta es invocada: puede subir a tu línea frontal.)',
    );
  });

  it('writes conditions, costs and usage limits', () => {
    const t = tokens.effect({
      instance: 'Turno Aliado>En Mano',
      ussageLimit: 'once per turn between copies',
      effectBlocks: [{ activationCondition: 'si un aliado es destruido', cost: 'puedes tributar 1 carta', resolution: 'roba 1 carta.' }],
    });
    expect(text(t)).toBe('<Turno Aliado><En Mano> <una vez por turno> entre copias, si un aliado es destruido: puedes tributar 1 carta; roba 1 carta.');
    expect(text(tokens.effect({ ussageLimit: 'ultimate effect', effectBlocks: [{ resolution: 'gana 1 gema.' }] }))).toBe('[ED] gana 1 gema.');
  });

  it('shrinks the text until it fits', () => {
    const many = tokens.slot([{ effectBlocks: [{ resolution: 'palabra '.repeat(60).trim() }] }], []);
    const measure = (t: string, font: string) => t.length * Number(/(\d+(?:\.\d+)?)px/.exec(font)![1]) * 0.5;
    const big = layoutFit(many, 660, 2000, measure);
    const small = layoutFit(many, 660, 200, measure);
    expect(big.pt).toBe(7);
    expect(small.pt).toBeLessThan(7);
  });
});
