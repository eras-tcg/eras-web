import { findSlot } from '@data/simulator/game-rules';
import { GameState } from '@data/simulator/simulator.model';
import { handPlace, lifePlace } from './board-dom';
import { CardFlyer } from './card-flyer';
import { Seen, TableMeasure } from './card-seen';
import { LAYER, TIMING } from './timing';

/**
 * The life lost by direct damage: before its update is shown it turns face up where it lies on its pile; when the
 * update asks its owner to Reforzar with it (or to play it), it waits face up on top of the lives (not in the hand) until
 * the answer, then goes to the bottom of the lives, to the table or to the hand.
 */
export class LifeFlights {
  /** Lives turned face up on their pile before their update is shown, and the state they were shown on. */
  private shown: { element: HTMLElement; on: GameState | null }[] = [];
  /** How each life shown face up was drawn on its pile (it may wait there while its owner decides to Reforzar). */
  private readonly lifeSeen = new Map<string, Seen>();
  /** Lives waiting face up on top of their pile while their owner decides to Reforzar. */
  private readonly parked = new Map<string, { seen: Seen; element: HTMLElement }>();
  /** Lives that flew this update (leaving their place on top of the lives): the other flights leave them alone. */
  readonly flown = new Set<string>();

  constructor(
    private readonly document: Document,
    private readonly measure: TableMeasure,
    private readonly flyer: CardFlyer,
  ) {}

  /** A life waits on top of its pile: it does not fly with the update. */
  isParked(id: string): boolean {
    return this.parked.has(id);
  }

  /**
   * Before its update is shown, the life lost turns face up where it lies on its pile and stays so (over the pile)
   * until the update is shown. `shownOn`: the state shown now.
   */
  show(owner: string, lifeId: string, next: GameState, shownOn: GameState | null): void {
    const life = lifePlace(this.document, owner, lifeId);
    const imageUrl = findSlot(next, lifeId)?.imageUrl;
    if (!life || !imageUrl) return;
    // Laid over the life's card, inside it (it is positioned): it lies as the life lies (sideways, on the leaning table)
    const face = this.document.createElement('div');
    Object.assign(face.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '2',
      borderRadius: '6px',
      background: `center / cover url("${imageUrl}")`,
      boxShadow: '0 0 0 2px var(--color-sim-rival), 0 0 16px 4px color-mix(in srgb, var(--color-sim-rival) 55%, transparent)',
      pointerEvents: 'none',
    });
    const card = life.querySelector<HTMLElement>('eras-game-card') ?? life;
    card.append(face);
    this.lifeSeen.set(lifeId, this.measure.seenOf(card, { imageUrl }));
    this.shown.push({ element: face, on: shownOn });
    face.animate([{ transform: 'rotateY(90deg)' }, { transform: 'rotateY(0)' }], { duration: TIMING.lifeFlip, easing: 'ease-out' });
  }

  /**
   * An update is shown: the lives turned face up go (each flies from its pile, face up), and a life its owner is asked
   * to Reforzar with waits face up on top of its lives, hidden in the hand, until the answer.
   */
  park(state: GameState): void {
    this.shown = this.shown.filter((l) => (l.on === state ? true : (l.element.remove(), false)));
    const prompt = state.prompt;
    // Reforzar, or play a revealed utility or structure: for its owner and for the rival alike (the server shows it to both)
    const id = prompt?.purpose === 'REINFORCE' || prompt?.purpose === 'LIFE_PLAY' ? prompt.subjectId : null;
    const seen = id ? this.lifeSeen.get(id) : undefined;
    if (id && seen && !this.parked.has(id)) {
      const { element, inner } = this.flyer.still(seen);
      inner.style.filter = 'drop-shadow(0 0 10px color-mix(in srgb, var(--color-sim-rival) 70%, transparent))';
      element.style.zIndex = LAYER.parkedLife;
      this.parked.set(id, { seen, element });
    }
    this.lifeSeen.clear();
    // Not in the hand meanwhile
    for (const parkedId of this.parked.keys()) {
      const inHand = handPlace(this.document, parkedId);
      if (inHand) inHand.style.visibility = 'hidden';
    }
  }

  /** Answered: a parked life goes from the top of its lives to where it is now (their bottom, or the hand). */
  unpark(state: GameState, me: string | undefined): void {
    this.flown.clear();
    for (const [id, { seen, element }] of [...this.parked]) {
      if (state.prompt?.subjectId === id) continue;
      this.parked.delete(id);
      const inHand = handPlace(this.document, id);
      if (inHand) inHand.style.visibility = '';
      const to = this.measure.destination(state, id, me);
      element.remove();
      if (!to) continue;
      // The real card (in the hand, or at the bottom of the lives) waits hidden until the copy lands
      const card = inHand?.querySelector<HTMLElement>('eras-game-card') ?? (to.element instanceof HTMLElement && to.element.matches('eras-game-card') ? to.element : null);
      this.flyer.fly(seen, card ?? to.element, to.faceDown, { hide: card });
      this.flown.add(id);
    }
  }
}
