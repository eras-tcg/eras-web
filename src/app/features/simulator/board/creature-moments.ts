import { ApplicationRef, EnvironmentInjector, createComponent } from '@angular/core';
import { cardCreatureUrl } from '@data/cards/card-rules';
import { CatalogCard } from '@data/cards/card.model';
import { CreatureSummonComponent } from '@ui/domain/creature-summon/creature-summon.component';
import { animationPace } from './timing';

/** What a full-art summon shows: the creature cut out of its card, its name, strength and identity color. */
export interface CreatureMoment {
  creature: string;
  name: string;
  strength: number;
  identity: string;
}

/** How long a summon waits for its creature's picture before the card just lands (it was not loaded in time). */
const PATIENCE = 900;

/** The moment of a catalog card with its creature cut out (a full-art card), or null. */
export function creatureMomentOf(card: CatalogCard | undefined, strength: number): CreatureMoment | null {
  const creature = cardCreatureUrl(card?.meta);
  if (!card || !creature) return null;
  const identity = card.color_identity ? `var(--color-card-${card.color_identity.toLowerCase()})` : '#64748b';
  return { creature, name: card.name ?? '', strength, identity };
}

/**
 * Plays full-art summons over the board: each one a CreatureSummonComponent of its own on the page, gone once it ends.
 * Their pictures are fetched ahead (the cards in the hands), so the moment does not wait for them.
 */
export class CreatureMoments {
  private readonly fetched = new Set<string>();

  constructor(
    private readonly document: Document,
    private readonly app: ApplicationRef,
    private readonly injector: EnvironmentInjector,
  ) {}

  /** Fetches the creatures' pictures ahead of their summons. */
  preload(urls: Iterable<string>): void {
    for (const url of urls) {
      if (this.fetched.has(url)) continue;
      this.fetched.add(url);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
    }
  }

  /** Shows the moment; done once it has faded away (at once if its picture is not there in time). */
  play(moment: CreatureMoment): Promise<void> {
    return new Promise((done) => {
      const ref = createComponent(CreatureSummonComponent, { environmentInjector: this.injector });
      ref.setInput('creature', moment.creature);
      ref.setInput('name', moment.name);
      ref.setInput('strength', moment.strength);
      ref.setInput('identity', moment.identity);
      ref.setInput('patience', PATIENCE);
      ref.setInput('pace', animationPace());
      this.app.attachView(ref.hostView);
      this.document.body.append(ref.location.nativeElement);
      const sub = ref.instance.done.subscribe(() => {
        sub.unsubscribe();
        this.app.detachView(ref.hostView);
        ref.destroy();
        done();
      });
    });
  }
}
