import { describe, expect, it } from 'vitest';
import { actionLabel, effectActions, matchesFilter, parseFilter } from './effect-actions';

const kinds = (text: string) => effectActions(text).map((a) => a.kind);

describe('effectActions', () => {
  it('reads mill, take-from-tributes and their filters (Eisten)', () => {
    const a = effectActions('<En Invocación> tributa 4 cartas del tope de tu mazo. Luego: toma hasta 1 carta Azúl de tus tributos.');
    expect(a).toEqual([
      { kind: 'mill', count: 4 },
      { kind: 'takeFromTributes', count: 1, upTo: true, filter: { colors: ['B'], classes: [] } },
    ]);
  });

  it('reads "look at the top N and take up to K" with two colors (Flureteus)', () => {
    const [look, hand] = effectActions(
      '<En Invocación> mira las primeras 5 cartas de tu mazo: de ellas toma hasta 2 cartas Azules o Blancas. Envía el resto al fondo de tu mazo. Luego: tributa 2 cartas de tu mano.',
    );
    expect(look).toEqual({ kind: 'lookTop', look: 5, take: 2, filter: { colors: ['B', 'W'], classes: [] } });
    expect(hand).toEqual({ kind: 'handToTributes', count: 2, upTo: false });
  });

  it('reads destroy targets with strength or level limits, also with "elegir" and ";;"', () => {
    expect(effectActions('<Al Atacar> [once per turn] elige 1 enemigo de fuerza 5 o menos; destrúyelo.')).toEqual([
      { kind: 'destroy', count: 1, upTo: false, filter: { colors: [], classes: [], maxStrength: 5 } },
    ]);
    expect(effectActions('<En Invocación> puedes elegir 1 enemigo nivel 1;; destrúyelo.')[0]).toMatchObject({ filter: { level: 1 } });
    expect(effectActions('<Al Atacar> elige hasta 2 enemigos de fuerza 3 o menos: destrúyelos.')[0]).toMatchObject({ count: 2, upTo: true });
  });

  it('tolerates the typos in the data ("catas", "de del")', () => {
    expect(kinds('tributa 2 catas del tope de tu mazo.')).toEqual(['mill']);
    expect(kinds('tributa 2 cartas de del tope de tu mazo.')).toEqual(['mill']);
  });

  it('reads strength changes, materials, gems, lives and untap', () => {
    expect(effectActions('puedes tributar 2 materiales de esta carta para elegir 1 enemigo; reduce en 4 su fuerza hasta el final del turno.')).toEqual([
      { kind: 'materialsToTributes', count: 2, upTo: false },
      { kind: 'reduceStrength', amount: 4, all: false, untilOpponentTurn: false },
    ]);
    expect(kinds('puedes agotar esta carta para ganar 1 gema y robar 1 carta. Si lo haces: tributa 1 carta de tu mano.')).toEqual([
      'gainGem',
      'draw',
      'handToTributes',
    ]);
    expect(effectActions('coloca la carta del tope de tu mazo al tope de tus vidas bocabajo.')).toEqual([{ kind: 'deckTopToLife', faceUp: false }]);
    expect(kinds('[once per turn] si destruyes algún enemigo: puedes reactivar esta carta.')).toEqual(['untapSelf']);
    expect(kinds('puedes destruir 1 carta bocarriba en las vidas oponentes.')).toEqual(['destroyLife']);
  });

  it('offers normal summons but leaves special summons to the board', () => {
    expect(effectActions('<En Juego> puedes invocar 1 criatura Roja de tu mano reduciendo su coste en 1.')).toEqual([
      { kind: 'summon', count: 1, from: 'hand', filter: { colors: ['R'], classes: [] } },
    ]);
    expect(effectActions('esta carta puede invocar por Evolución 1 [dragón] de tu mano reduciendo el coste especial en 1.')).toEqual([]);
  });

  it('returns nothing for passive rules', () => {
    expect(effectActions('<En Tributos> esta carta puede considerarse como si estuviera en tu mano para invocaciones especiales.')).toEqual([]);
  });

  it('labels actions in Spanish', () => {
    expect(actionLabel({ kind: 'takeFromTributes', count: 1, upTo: false, filter: parseFilter('Verde o [dragón] nivel 1') })).toBe(
      'Tomar 1 de tributos (Verde o [dragón] nivel 1)',
    );
    expect(actionLabel({ kind: 'draw', count: 1 })).toBe('Robar 1 carta');
  });
});

describe('matchesFilter', () => {
  const blueEnte = { colorIdentity: 'B', classes: ['ente'], level: 2, strength: 5 };

  it('treats colors and classes as alternatives', () => {
    expect(matchesFilter(blueEnte, parseFilter('Verde o [ente]'))).toBe(true);
    expect(matchesFilter(blueEnte, parseFilter('Verde o [dragón]'))).toBe(false);
    expect(matchesFilter({ colorIdentity: 'R', colors: ['G'] }, parseFilter('Verde'))).toBe(true);
  });

  it('applies level and strength limits', () => {
    expect(matchesFilter(blueEnte, parseFilter('de fuerza 5 o menos'))).toBe(true);
    expect(matchesFilter(blueEnte, parseFilter('nivel 1 o menor'))).toBe(false);
    expect(matchesFilter(blueEnte, parseFilter('[ente] nivel 2'))).toBe(true);
    expect(matchesFilter({ colorIdentity: 'B' }, parseFilter(''))).toBe(true);
  });
});
