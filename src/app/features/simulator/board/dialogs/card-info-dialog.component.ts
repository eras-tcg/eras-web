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
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { IconButtonComponent } from '@ui/primitives/icon-button/icon-button.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { displayStrength } from '@data/simulator/game-rules';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../../../cards/card-detail-dialog/card-detail-dialog.component';
import { effectLines } from '../card-effect-lines';

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
  imports: [IconComponent, ModalComponent, GameCardComponent, StackComponent, SectionHeaderComponent, EmptyStateComponent, CdkMenuTrigger, MenuComponent, MenuItemDirective, IconButtonComponent],
  templateUrl: './card-info-dialog.component.html',
  styleUrl: './card-info-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardInfoDialogComponent {
  protected readonly data = inject<CardInfoData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly game = inject(GameStore);
  private readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);
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

  private lines(effects: Parameters<typeof effectLines>[0], keywords: Parameters<typeof effectLines>[1]) {
    return effectLines(effects, keywords, this.cards.ref());
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
      return { id: r.instanceId, slot: r, name: r.cardName ?? 'Recurso', imageUrl: r.imageUrl, lines: this.lines(m?.inheritEffects, m?.inheritKeywordEffects) };
    }),
  );
  /**
   * What it has now beyond what is printed: its current strength, what effects gave or took for a while (with
   * their source), its continuous effects that hold and any manual adjustment. Null when there is nothing.
   */
  protected readonly modifiers = computed(() => {
    const s = this.slot();
    if (!s || s.faceDown || this.data.zone !== 'field') return null;
    const now = displayStrength(s);
    const strength = s.strength != null && now !== s.strength ? { base: s.strength, now } : null;
    const floating = s.floating ?? [];
    const gained = [...(s.continuousStrength ? [`fuerza ${s.continuousStrength > 0 ? '+' : ''}${s.continuousStrength}`] : []), ...(s.continuousKeywords ?? [])];
    const continuous = gained.length ? `Gana ${gained.join(', ')}` : null;
    const manual = s.strengthModifier || 0;
    return strength || floating.length || continuous || manual ? { strength, floating, continuous, manual } : null;
  });

  /** The effects its Recursos give it, with their source. */
  protected readonly inherited = computed(() => this.resourceViews().flatMap((r) => r.lines.map((line) => ({ source: r.name, line }))));
  protected readonly ownLines = this.own;
  protected readonly inheritedLines = computed(() => this.inherited().map((e) => ({ source: e.source, line: e.line })));

  /** Its printed numbers at a glance; the strength as it is now (marked when it changed). */
  protected readonly facts = computed(() => {
    const s = this.slot();
    if (!s || (s.faceDown && !this.game.seeAll())) return [];
    const facts: { label: string; value: string; changed?: boolean }[] = [];
    if (s.level != null) facts.push({ label: 'Nivel', value: String(s.level) });
    if (s.cost != null) facts.push({ label: 'Coste', value: String(s.cost) });
    if (s.strength != null) {
      const now = this.data.zone === 'field' ? displayStrength(s) : s.strength;
      facts.push({ label: 'Fuerza', value: String(now), changed: now !== s.strength });
    }
    if (s.classes?.length) facts.push({ label: 'Clase', value: s.classes.join(' · ') });
    return facts;
  });

  /** The card in detail, as in the cards catalog. */
  protected openDetail(card: CardSlot): void {
    const catalog = this.cards.cards().find((c) => c.id === card.cardId);
    if (!catalog) return;
    const data: CardDetailDialogData = { cards: [catalog], index: 0 };
    this.modal.open(CardDetailDialogComponent, { data });
  }

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
