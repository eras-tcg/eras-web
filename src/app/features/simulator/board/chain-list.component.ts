import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GameStore } from '@data/simulator/game.store';
import { CardWithSourceComponent } from '@ui/domain/card-with-source/card-with-source.component';

/**
 * The chain being built or resolved: the highest link first, since it resolves first (rule 11.3.0.6).
 * Shown on the board and inside the engine's choices, so it is clear what is chained and what resolves now.
 */
@Component({
  selector: 'eras-chain-list',
  imports: [CardWithSourceComponent],
  template: `
    @if (links().length) {
      <section class="chain" aria-label="Cadena">
        <h3>Cadena <small>· se resuelve de arriba abajo</small></h3>
        <ol>
          @for (l of links(); track l.id) {
            <li [class.resolving]="l.resolving" [class.mine]="l.mine">
              <span class="link">{{ l.link }}</span>
              <!-- Its card; an inherited effect, with the Recurso that gives it small at the corner (as in the chaining choice) -->
              <eras-card-with-source class="thumb" [imageUrl]="l.imageUrl" [name]="l.sourceName" [sourceName]="l.inheritedFromName" [sourceImage]="l.sourceImage" />
              <span class="name">{{ l.sourceName }} · {{ l.label }}@if (l.inheritedFromName) {<small class="inherited">Heredado de {{ l.inheritedFromName }}</small>}<small class="text">{{ l.text }}</small></span>
              <span class="state">{{ l.resolving ? 'resolviendo' : l.mine ? 'tuyo' : 'del rival' }}</span>
            </li>
          }
        </ol>
      </section>
    }
  `,
  styles: `
    .chain { display: grid; gap: var(--space-1); }
    h3 { margin: 0; font-size: var(--font-size-sm); }
    small { color: var(--color-text-muted); font-weight: normal; }
    ol { display: grid; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
    li {
      display: grid;
      grid-template-columns: auto auto 1fr auto;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      font-size: var(--font-size-sm);
    }
    li.resolving { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
    .link {
      display: inline-grid;
      place-items: center;
      inline-size: 1.5rem;
      block-size: 1.5rem;
      border-radius: 50%;
      background: var(--color-surface-muted);
      font-weight: var(--font-weight-bold);
    }
    li.resolving .link { background: var(--color-primary); color: var(--color-on-primary, #fff); }
    .state { color: var(--color-text-muted); font-size: var(--font-size-xs); }
    .name { display: grid; }
    .text { color: var(--color-text-muted); font-size: var(--font-size-xs); }
    .inherited { font-size: var(--font-size-xs); }
    .thumb { --game-card-width: 2.4rem; margin-inline-end: var(--space-1); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChainListComponent {
  private readonly game = inject(GameStore);
  private readonly cards = inject(CardsStore);

  protected readonly links = computed(() => {
    const me = this.game.myState()?.userId;
    return [...(this.game.state()?.chain ?? [])].reverse().map((e) => ({
      ...e,
      mine: e.controllerId === me,
      resolving: !!e.resolutionId,
      imageUrl: this.imageOf(e.sourceInstanceId, e.sourceName),
      sourceImage: e.inheritedFromImage ?? (e.inheritedFromName ? this.imageOf(null, e.inheritedFromName) : null),
    }));
  });

  /** A card's art: as it is on the table, else from the catalogue by its name. */
  private imageOf(id: string | null, name: string): string | null {
    for (const p of Object.values(this.game.state()?.players ?? {})) {
      for (const c of [...p.field, ...p.hand, ...p.tributeZone, ...p.discardPile, ...p.lifeStack]) {
        if (c.instanceId === id) return c.imageUrl ?? null;
        const attached = [...c.materials, ...c.resources].find((a) => a.instanceId === id);
        if (attached) return attached.imageUrl ?? null;
      }
    }
    return this.cards.cards().find((c) => c.name === name)?.image_url ?? null;
  }
}
