import { ZoneName } from '@data/simulator/simulator.model';

/**
 * Where the board draws each card and pile (its `data-*` marks), for the animations that measure them or draw over
 * them. The one place that knows those marks.
 */

/** A card on a field, as drawn (its game card). */
export function fieldCard(doc: Document, id: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[data-instance-id="${id}"] eras-game-card`);
}

/** A field card's place (the box around it, that moves with it). */
export function fieldPlace(doc: Document, id: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[data-instance-id="${id}"]`);
}

/** A card in a hand, as drawn. */
export function handCard(doc: Document, id: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[data-hand-id="${id}"] eras-game-card`);
}

/** A card in a hand: its place in the fan. */
export function handPlace(doc: Document, id: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[data-hand-id="${id}"]`);
}

/** A card on a field or in a hand, as drawn. */
export function tableCard(doc: Document, id: string): HTMLElement | null {
  return fieldCard(doc, id) ?? handCard(doc, id);
}

/** A player's pile (or their hand's zone). */
export function pile(doc: Document, ownerId: string, zone: ZoneName): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[data-pile="${ownerId}:${zone}"]`);
}

/** A pile by its mark ("<owner>:<zone>"). */
export function pileByKey(doc: Document, key: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[data-pile="${key}"]`);
}

/** One life in its pile (its own place), as drawn. */
export function lifeCard(doc: Document, ownerId: string, id: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[data-pile="${ownerId}:lifeStack"] [data-life-id="${id}"] eras-game-card`);
}

/** One life's place in its pile. */
export function lifePlace(doc: Document, ownerId: string, id: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[data-pile="${ownerId}:lifeStack"] [data-life-id="${id}"]`);
}

/** The center of an element on the screen. */
export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
