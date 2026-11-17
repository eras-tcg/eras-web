import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CardMeta, CatalogCard, COLOR_LABELS } from '@data/cards/card.model';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { CardsStore } from '@data/cards/cards.store';
import { EditionSlot, editionSlots } from '@data/editions/edition-slots';
import { EditionsStore } from '@data/editions/editions.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { firstValueFrom } from 'rxjs';
import { MoveChain, chainMetas, finalMoves, placeInSlot, slotCode } from './card-move-rules';

export interface CardMoveData {
  /** The card picked up. */
  card: CardMeta;
}

/**
 * Moves a card to another slot of its color, in any edition. Choosing a slot with a card asks whether to take that
 * card out; if so, it is the next one to place, and the chain goes on until a card lands in an empty slot. Nothing is
 * saved until then (all the moves at once); the card being moved is always shown at the top.
 */
@Component({
  selector: 'eras-card-move-dialog',
  imports: [ModalComponent, ButtonComponent, AlertComponent],
  template: `
    <eras-modal title="Mover carta" size="xl" (closed)="ref.close()">
      <div class="layout">
        <aside class="hand" aria-live="polite">
          @if (chain().hand; as h) {
            <span class="label">Moviendo</span>
            <div class="card-img">
              @if (imageOf(h); as src) {
                <img [src]="src" alt="" />
              } @else {
                <span class="name">{{ h.cardName }}</span>
              }
            </div>
            <strong>{{ h.cardName }}</strong>
            <span class="from">Estaba en {{ originalCode(h) }}</span>
          }
          @if (chain().moves.length) {
            <ol class="moves">
              @for (m of chain().moves; track $index) {
                <li>{{ nameOf(m.id) }} → {{ code(m.edition, m.subEdition, colorOf(m.id), m.cardNumber) }}</li>
              }
            </ol>
          }
        </aside>
        <section class="pick">
          <label class="field">
            <span>Edición</span>
            <select (change)="editionId.set($any($event.target).value)">
              @for (e of editions(); track e.editionId) {
                <option [value]="e.editionId" [selected]="e.editionId === editionId()">{{ e.editionId }}{{ e.editionName ? ' · ' + e.editionName : '' }}</option>
              }
            </select>
          </label>
          @if (asking(); as a) {
            <eras-alert tone="info">
              {{ a.code }} tiene a <strong>{{ a.slot.meta?.cardName }}</strong>. ¿La sacas para ubicarla después?
              <div class="ask">
                <button erasButton size="sm" type="button" (click)="takeOut()">Sí, sácala</button>
                <button erasButton size="sm" variant="ghost" type="button" (click)="asking.set(null)">No</button>
              </div>
            </eras-alert>
          }
          @if (error(); as e) {
            <eras-alert tone="danger">{{ e }}</eras-alert>
          }
          <p class="hint">{{ colorLabel() }} · {{ editionId() }}</p>
          <div class="grid">
            @for (s of slots(); track s.code) {
              <button
                type="button"
                class="slot"
                [class.empty]="!s.meta"
                [class.asked]="asking()?.code === s.code"
                [disabled]="saving()"
                [attr.aria-label]="s.code + (s.meta ? ' ' + s.meta.cardName : ' vacío')"
                (click)="choose(s)"
              >
                @if (s.meta) {
                  @if (imageOf(s.meta, s.card); as src) {
                    <img [src]="src" alt="" loading="lazy" />
                  } @else {
                    <span class="name">{{ s.meta.cardName }}</span>
                  }
                }
                <span class="code">{{ s.code }}</span>
              </button>
            }
          </div>
        </section>
      </div>
      <div modal-footer class="footer">
        <button erasButton variant="ghost" type="button" [disabled]="saving()" (click)="ref.close()">
          {{ chain().moves.length ? 'Cancelar y no mover nada' : 'Cancelar' }}
        </button>
      </div>
    </eras-modal>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(10rem, 14rem) 1fr;
      gap: var(--space-5);
      min-height: 0;
    }
    .hand {
      position: sticky;
      top: 0;
      align-self: start;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      z-index: 1;
      background: var(--color-surface);
    }
    /* Narrow: the card being moved stays on top as a small picture beside its name */
    @media (max-width: 720px) {
      .layout {
        grid-template-columns: 1fr;
        gap: var(--space-3);
      }
      .hand {
        display: grid;
        grid-template-columns: 4.5rem 1fr;
        column-gap: var(--space-3);
        align-items: center;
        padding-block-end: var(--space-2);
        border-block-end: 1px solid var(--color-border);
      }
      .hand .card-img {
        grid-row: span 3;
      }
      .hand .label,
      .hand strong,
      .hand .from,
      .hand .moves {
        grid-column: 2;
      }
    }
    .label {
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
    }
    .card-img {
      aspect-ratio: 744 / 1039;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--color-surface-muted);
      display: grid;
      place-items: center;
      box-shadow: 0 0 0 2px var(--color-primary);
    }
    .card-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .from {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }
    .moves {
      margin: 0;
      padding-left: var(--space-4);
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }
    .pick {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-width: 0;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      max-width: 28rem;
    }
    .field select {
      font: inherit;
      padding: var(--space-2);
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
    }
    .ask {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }
    .hint {
      margin: 0;
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
      gap: var(--space-2);
      max-height: 60dvh;
      overflow-y: auto;
      padding: 2px;
    }
    .slot {
      position: relative;
      aspect-ratio: 744 / 1039;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
      background: var(--color-surface-muted);
      padding: 0;
      overflow: hidden;
      cursor: pointer;
      display: grid;
      place-items: center;
      color: var(--color-text);
    }
    .slot.empty {
      border-style: dashed;
      background: transparent;
    }
    .slot:hover,
    .slot.asked {
      box-shadow: 0 0 0 2px var(--color-primary);
    }
    .slot img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .slot .name {
      padding: var(--space-1);
      font-size: var(--font-size-sm);
      text-align: center;
    }
    .slot .code {
      position: absolute;
      bottom: 0;
      inset-inline: 0;
      font-size: var(--font-size-xs);
      background: color-mix(in srgb, var(--color-surface) 80%, transparent);
      text-align: center;
    }
    .footer {
      display: flex;
      justify-content: flex-end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardMoveDialogComponent {
  protected readonly data = inject<CardMoveData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly cards = inject(CardsStore);
  private readonly editionsStore = inject(EditionsStore);
  private readonly api = inject(CardsAdminApi);

  /** The cards as they were when the dialog opened (what the moves are compared with). */
  private readonly original = this.cards.metaList();
  protected readonly chain = signal<MoveChain>({ moves: [], hand: this.data.card });
  protected readonly editionId = signal(
    `${this.data.card.edition ?? ''}${this.data.card.subEdition ? '.' + this.data.card.subEdition : ''}`,
  );
  protected readonly asking = signal<{ code: string; slot: EditionSlot } | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The editor's finished images, fetched with the session, by card id and render. */
  private readonly renders = signal<Record<string, string>>({});
  private readonly asked = new Set<string>();

  private readonly color = (this.data.card.colorIdentity ?? '').toUpperCase();
  protected readonly colorLabel = computed(() => COLOR_LABELS[this.color] ?? this.color);
  protected readonly editions = computed(() => this.editionsStore.catalogEditions());
  /** The chosen edition's slots of the card's color, with the chain's moves applied. */
  protected readonly slots = computed(() => {
    const e = this.editions().find((x) => x.editionId === this.editionId());
    if (!e) return [];
    const groups = editionSlots(e, chainMetas(this.original, this.chain()), this.cards.cards());
    return groups.find((g) => g.color === this.color)?.slots ?? [];
  });

  constructor() {
    effect(() => {
      const metas = [...this.slots().map((s) => s.meta), this.chain().hand];
      for (const m of metas) {
        const key = m?.renderKey ? `${m.id}|${m.renderKey}` : null;
        if (!m || !key || this.driveImage(m) || this.asked.has(key)) continue;
        this.asked.add(key);
        void firstValueFrom(this.api.render(m.id))
          .then((blob) => this.renders.update((r) => ({ ...r, [key]: URL.createObjectURL(blob) })))
          .catch(() => undefined);
      }
    });
  }

  protected code = slotCode;

  protected nameOf(id: string): string {
    return this.original.find((m) => m.id === id)?.cardName ?? id;
  }

  protected colorOf(id: string): string {
    return this.original.find((m) => m.id === id)?.colorIdentity ?? this.color;
  }

  protected originalCode(m: CardMeta): string {
    const o = this.original.find((x) => x.id === m.id) ?? m;
    return slotCode(o.edition ?? '', o.subEdition, o.colorIdentity ?? '', o.cardNumber ?? 0);
  }

  private driveImage(m: CardMeta, card?: CatalogCard | null): string | null {
    const c = card ?? this.cards.cards().find((x) => x.meta?.id === m.id) ?? null;
    return c ? cardImageUrl(c) : null;
  }

  protected imageOf(m: CardMeta, card?: CatalogCard | null): string | null {
    return this.driveImage(m, card) ?? (m.renderKey ? (this.renders()[`${m.id}|${m.renderKey}`] ?? null) : null);
  }

  protected choose(s: EditionSlot): void {
    this.error.set(null);
    if (s.meta) {
      this.asking.set({ code: s.code, slot: s });
      return;
    }
    this.asking.set(null);
    this.chain.update((c) => placeInSlot(c, this.editionId(), s.number, null));
    void this.save();
  }

  protected takeOut(): void {
    const a = this.asking();
    if (!a?.slot.meta) return;
    const occupant = a.slot.meta;
    this.asking.set(null);
    this.chain.update((c) => placeInSlot(c, this.editionId(), a.slot.number, occupant));
  }

  private async save(): Promise<void> {
    const moves = finalMoves(this.chain(), this.original);
    if (!moves.length) {
      this.ref.close(false);
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.moveSlots(moves));
      await this.cards.load(true);
      this.ref.close(true);
    } catch (e) {
      const msg = (e as { error?: { message?: string } })?.error?.message;
      this.error.set(msg ?? 'No se pudieron mover las cartas. No se guardó nada.');
      // The last card back in hand, so another slot can be chosen
      this.chain.update((c) => ({ moves: c.moves.slice(0, -1), hand: this.original.find((m) => m.id === c.moves.at(-1)?.id) ?? c.hand }));
    } finally {
      this.saving.set(false);
    }
  }
}
