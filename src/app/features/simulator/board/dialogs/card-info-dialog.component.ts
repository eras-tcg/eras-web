import { CdkMenuTrigger } from '@angular/cdk/menu';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { renderEffect, renderKeywordEffect } from '@data/cards/card-rules';
import { CardEffect, KeywordEffect } from '@data/cards/card.model';

export type AttachmentType = 'materials' | 'resources';

export interface CardInfoData {
  instanceId: string;
  zone: ZoneName;
  opponent: boolean;
  /** Only show this attachment group (from "Separar materiales/recursos"). */
  only?: AttachmentType;
  /** Only to look at it (a choice is lowered): no actions. */
  readonly?: boolean;
}

const ATTACH_LABELS: Record<AttachmentType, string> = { materials: 'Materiales', resources: 'Recursos' };

/** Card details on the board plus its attachments (materials/resources) and what can be done with them. */
@Component({
  selector: 'eras-card-info-dialog',
  imports: [ModalComponent, GameCardComponent, StackComponent, SectionHeaderComponent, EmptyStateComponent, ButtonComponent, CdkMenuTrigger, MenuComponent, MenuItemDirective],
  template: `
    <eras-modal size="xl" [title]="data.only ? 'Separar ' + labels[data.only].toLowerCase() : (slot()?.cardName ?? 'Carta')" (closed)="ref.close()">
      @if (slot(); as s) {
        <eras-stack [gap]="4">
          @if (!data.only) {
            <div class="info">
              <div class="art">
                <eras-game-card class="main" [imageUrl]="s.imageUrl" [materialsCount]="s.materials.length" />
                <!-- Its Recursos under it, as on the table: only their name and the effect they pass on (just the name if none) -->
                @for (r of resourceViews(); track r.id) {
                  <div class="resource" [class.name-only]="r.lines.length === 0" role="img" [attr.aria-label]="'Recurso: ' + r.name">
                    @if (r.imageUrl) {
                      <img [src]="r.imageUrl" alt="" />
                    } @else {
                      <span>{{ r.name }}</span>
                    }
                  </div>
                }
              </div>
              <div class="effects">
                @if (own().length) {
                  <section>
                    <h4>Efectos</h4>
                    @for (line of own(); track $index) {
                      <p>{{ line }}</p>
                    }
                  </section>
                } @else {
                  <p class="muted">Sin efectos.</p>
                }
                @if (inherited().length) {
                  <section>
                    <h4>Efectos de sus recursos</h4>
                    @for (e of inherited(); track $index) {
                      <p><span class="source">{{ e.source }}:</span> {{ e.line }}</p>
                    }
                  </section>
                }
              </div>
            </div>
          }
          @for (type of groups(); track type) {
            <eras-section-header [title]="labels[type] + ' (' + s[type].length + ')'" />
            <eras-stack direction="row" [gap]="3" wrap>
              @for (a of s[type]; track a.instanceId; let i = $index) {
                <eras-stack [gap]="1" align="center">
                  <eras-game-card small [imageUrl]="a.imageUrl" [hidden]="a.faceDown" [attr.aria-label]="a.cardName" />
                  @if (!data.readonly) {
                    <button erasButton variant="secondary" size="sm" type="button" [cdkMenuTriggerFor]="actions" [attr.aria-label]="'Acciones de ' + (a.cardName ?? 'anexo')">Mover…</button>
                  }
                  <ng-template #actions>
                    <eras-menu>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'hand')">A la mano</button>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'discardPile')">Al descarte</button>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'tributeZone')">A tributos</button>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'deck', 'bottom')">Al fondo del mazo</button>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'lifeStack', 'top', true)">A las vidas (boca abajo)</button>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'field')">Al campo</button>
                      <hr />
                      <button erasMenuItem (triggered)="game.swapWithMain(a.instanceId, type, s.instanceId, targetPlayer())">Intercambiar con la principal</button>
                      <button erasMenuItem (triggered)="game.reclassifyAttachment(a.instanceId, type, s.instanceId, targetPlayer())">
                        Pasar a {{ type === 'materials' ? 'recursos' : 'materiales' }}
                      </button>
                      @if (i > 0) {
                        <button erasMenuItem (triggered)="reorder(s, type, i, -1)">Subir</button>
                      }
                      @if (i < s[type].length - 1) {
                        <button erasMenuItem (triggered)="reorder(s, type, i, 1)">Bajar</button>
                      }
                    </eras-menu>
                  </ng-template>
                </eras-stack>
              }
            </eras-stack>
          }
        </eras-stack>
      } @else {
        <eras-empty-state title="La carta ya no está en esa zona" />
      }
    </eras-modal>
  `,
  styles: `
    .info { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-5); align-items: start; }
    .art { --game-card-width: 14rem; display: grid; justify-items: center; }
    .art eras-game-card { position: relative; }
    .art .main { z-index: 2; }
    // A Recurso shows the strip of its card from its name bar down (its heritable effect): 80%–100% of the card
    // height (ratio 63:88); without a heritable effect only the name bar (80%–87.5%)
    .resource {
      --card-height: calc(var(--game-card-width) * 88 / 63);
      inline-size: var(--game-card-width);
      block-size: calc(var(--card-height) * 0.2);
      overflow: hidden;
      border-radius: 0 0 var(--radius-md) var(--radius-md);
      background: var(--color-surface-muted);
      box-shadow: 0 2px 4px rgb(0 0 0 / 35%);
    }
    .resource.name-only { block-size: calc(var(--card-height) * 0.075); border-radius: 0; }
    .resource img { display: block; inline-size: 100%; margin-block-start: calc(var(--card-height) * -0.8); }
    .resource span { display: block; padding: var(--space-1) var(--space-2); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); }
    .effects { display: grid; gap: var(--space-3); }
    .effects h3 { margin: 0; font-size: var(--font-size-lg); }
    .effects h4 { margin: 0 0 var(--space-1); font-size: var(--font-size-sm); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .effects p { margin: 0 0 var(--space-2); }
    .effects .source { font-weight: var(--font-weight-bold); }
    .muted { color: var(--color-text-muted); }
    @media (max-width: 44rem) { .info { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardInfoDialogComponent {
  protected readonly data = inject<CardInfoData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly game = inject(GameStore);
  private readonly cards = inject(CardsStore);
  protected readonly labels = ATTACH_LABELS;

  /** Live slot: the dialog follows the card through every broadcast. */
  protected readonly slot = computed<CardSlot | null>(() => {
    const player = this.data.opponent ? this.game.opponentState() : this.game.myState();
    return player?.[this.data.zone].find((c) => c.instanceId === this.data.instanceId) ?? null;
  });
  /** Metadata of a card of the game, by its file id. */
  private meta(cardId: string | null | undefined) {
    return this.cards.cards().find((c) => c.id === cardId)?.meta ?? null;
  }

  private lines(effects: CardEffect[] | null | undefined, keywords: KeywordEffect[] | null | undefined): string[] {
    const ref = this.cards.ref();
    const text = (l: { segments: { text: string }[] }) => l.segments.map((x) => x.text).join('').trim();
    return [...(effects ?? []).map((e) => text(renderEffect(e, ref))), ...(keywords ?? []).map((k) => text(renderKeywordEffect(k, ref)))].filter(Boolean);
  }

  /** The card's own effects and keywords. */
  protected readonly own = computed(() => {
    const m = this.meta(this.slot()?.cardId);
    return this.lines(m?.effects, m?.keywordEffects);
  });
  /** Its Recursos, with what each one gives it. */
  protected readonly resourceViews = computed(() =>
    (this.slot()?.resources ?? []).map((r) => {
      const m = this.meta(r.cardId);
      return { id: r.instanceId, name: r.cardName ?? 'Recurso', imageUrl: r.imageUrl, lines: this.lines(m?.inheritEffects, m?.inheritKeywordEffects) };
    }),
  );
  /** The effects its Recursos give it, with their source. */
  protected readonly inherited = computed(() => this.resourceViews().flatMap((r) => r.lines.map((line) => ({ source: r.name, line }))));

  protected readonly groups = computed<AttachmentType[]>(() => {
    const s = this.slot();
    // Moving attachments by hand is only for "Separar materiales/recursos" (editor mode)
    if (!s || this.data.zone !== 'field' || !this.data.only) return [];
    if (this.data.only) return [this.data.only];
    return (['materials', 'resources'] as const).filter((t) => s[t].length > 0);
  });
  protected readonly targetPlayer = computed(() => (this.data.opponent ? (this.game.opponentState()?.userId ?? null) : null));

  protected moveOut(a: CardSlot, type: AttachmentType, toZone: ZoneName, position: 'top' | 'bottom' = 'bottom', faceDown = false): void {
    const parent = this.slot();
    if (!parent) return;
    this.game.moveFromAttachment({ instanceId: a.instanceId, attachmentOf: parent.instanceId, attachmentType: type, toZone, faceDown, position, targetPlayerId: this.targetPlayer() });
  }

  protected reorder(parent: CardSlot, type: AttachmentType, index: number, step: -1 | 1): void {
    const ids = parent[type].map((c) => c.instanceId);
    [ids[index], ids[index + step]] = [ids[index + step], ids[index]];
    this.game.reorderAttachment(parent.instanceId, type, ids, this.targetPlayer());
  }
}
