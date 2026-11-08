import type { LocalMatchConfig } from './engine-protocol';
import { GameRecorder, chosenDeck, deckCardIds } from './offline-record';

const body = (type: string, payload: object = {}) => JSON.stringify({ type, payload });
const config: LocalMatchConfig = {
  seed: '42',
  userId: 'u1',
  botLevel: 'easy',
  decks: {
    'deck-st1': { deckName: 'ST1', metadata: [{ id: 'm-a' }, { id: 'm-st', starter: true }] },
    d1: { deckName: 'Mío', cards: [{ card: { id: 'm-x' }, copies: 2, cardId: 'f-x' }, { card: { id: 'm-y' }, copies: 1 }] },
  },
};
const result = (gamesEnded: number) =>
  JSON.stringify({ status: 'POST_GAME', gamesEnded, winnerId: 'u1', endReason: 'lives', turns: 9, digest: '0123456789abcdef' });

describe('deckCardIds', () => {
  it('lists a deck one id per copy, as LocalMatch seats it', () => {
    expect(deckCardIds(config.decks['deck-st1'])).toEqual(['m-a', 'm-a', 'm-a', 'm-st']);
    expect(deckCardIds(config.decks['d1'])).toEqual(['f-x', 'f-x', 'm-y']);
  });

  it('reads the deck a body chooses', () => {
    expect(chosenDeck(body('SET_DECK', { deckId: 'd1' }))).toBe('d1');
    expect(chosenDeck(body('SET_DECK', { deckId: 'd1', actAs: 'bot' }))).toBe('d1');
    expect(chosenDeck(body('END_TURN'))).toBeNull();
    expect(chosenDeck('not json')).toBeNull();
  });
});

describe('GameRecorder', () => {
  it('records every action with the bot moves after it, and the game the moment it reaches its post-game', () => {
    const recorder = new GameRecorder(config, 1000);
    recorder.action(body('JOIN_ROOM', { username: 'Ana' }));
    expect(recorder.check('WAITING', () => result(0), 1100)).toBeNull();
    recorder.action(body('SET_DECK', { deckId: 'deck-st1' }));
    recorder.botMoved();
    recorder.action(body('SET_DECK', { deckId: 'd1', actAs: 'bot' }));
    recorder.action(body('END_TURN'));
    recorder.botMoved();
    recorder.botMoved();
    const result1 = vi.fn(() => result(1));
    const game = recorder.check('POST_GAME', result1, 5000);

    expect(game).toEqual({
      seed: '42',
      botLevel: 'easy',
      userId: 'u1',
      startedAt: 1000,
      endedAt: 5000,
      decks: { 'deck-st1': ['m-a', 'm-a', 'm-a', 'm-st'], d1: ['f-x', 'f-x', 'm-y'] },
      actions: [
        { body: body('JOIN_ROOM', { username: 'Ana' }), botMoves: 0 },
        { body: body('SET_DECK', { deckId: 'deck-st1' }), botMoves: 1 },
        { body: body('SET_DECK', { deckId: 'd1', actAs: 'bot' }), botMoves: 0 },
        { body: body('END_TURN'), botMoves: 2 },
      ],
      result: JSON.parse(result(1)),
    });
    // Once per post-game: the moves after it are not another game
    recorder.botMoved();
    expect(recorder.check('POST_GAME', result1, 6000)).toBeNull();
    expect(result1).toHaveBeenCalledTimes(1);
    // The record is a copy: what comes after does not change it
    expect(game?.actions[3].botMoves).toBe(2);
  });

  it('a rematch is another game, whose record carries the room from the start', () => {
    const recorder = new GameRecorder(config, 0);
    recorder.action(body('SET_DECK', { deckId: 'deck-st1' }));
    expect(recorder.check('POST_GAME', () => result(1), 1)?.result.gamesEnded).toBe(1);
    recorder.action(body('POST_GAME_CHOICE', { choice: 'rematch' }));
    expect(recorder.check('MULLIGAN', () => result(1), 2)).toBeNull();
    recorder.action(body('CONCEDE'));
    const second = recorder.check('POST_GAME', () => result(2), 3);
    expect(second?.result.gamesEnded).toBe(2);
    expect(second?.actions.map((a) => JSON.parse(a.body).type)).toEqual(['SET_DECK', 'POST_GAME_CHOICE', 'CONCEDE']);
  });
});
