import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { CardFactsComponent } from '@ui/domain/card-facts/card-facts.component';
import { EffectLineComponent } from '@ui/domain/effect-line/effect-line.component';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { HoldPeekDirective } from '../hold-peek';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { displayStrength } from '@data/simulator/game-rules';
import { formationGrants } from '@data/simulator/formations';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { openCardDetailDialog } from '../../../cards/card-detail-dialog/card-detail-dialog.component';
import { effectLines } from '../card-effect-lines';
import { slotFacts } from '../slot-facts';
import { SendDestination, destinationOf } from '../send-destinations';
import { SendToOption, chooseSendTo, destinationOptions } from './send-to-dialog.component';

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
  imports: [IconComponent, ModalComponent, EffectLineComponent, CardFactsComponent, GameCardComponent, StackComponent, SectionHeaderComponent, EmptyStateComponent, HoldPeekDirective],
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
  /** Criatura Enlace: its printed link effect (what it gives the neighbours it points to). */
  protected readonly ownLink = computed(() => {
    const m = this.meta(this.slot()?.cardId);
    return this.lines(m?.formationEffects, m?.formationKeywordEffects);
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

  /** Enlace: the link effects it receives now, by the member that gives each. */
  protected readonly grants = computed(() => {
    const s = this.slot();
    if (!s || this.data.zone !== 'field') return [];
    const field = (this.data.opponent ? this.game.opponentState() : this.game.myState())?.field ?? [];
    return formationGrants(s).flatMap((g) => {
      const m = this.meta(field.find((c) => c.instanceId === g.sourceId)?.cardId);
      return this.lines(m?.formationEffects, m?.formationKeywordEffects).map((line) => ({ source: g.sourceName, line }));
    });
  });

  /** The effects its Recursos give it, with their source. */
  protected readonly inherited = computed(() => this.resourceViews().flatMap((r) => r.lines.map((line) => ({ source: r.name, line }))));

  /** Its printed numbers at a glance; the strength as it is now (marked when it changed). */
  protected readonly facts = computed(() => {
    const s = this.slot();
    return slotFacts(s, { onField: this.data.zone === 'field', visible: !!s && (!s.faceDown || this.game.seeAll()) });
  });

  /** The card in detail, as in the cards catalog. */
  protected openDetail(card: CardSlot): void {
    const catalog = this.cards.cards().find((c) => c.id === card.cardId);
    if (catalog) openCardDetailDialog(this.modal, [catalog]);
  }

  // Moving attachments by hand is only for "Separar materiales/recursos" (editor mode)
  protected readonly groups = computed<AttachmentType[]>(() => (this.slot() && this.data.zone === 'field' && this.data.only ? [this.data.only] : []));
  protected readonly targetPlayer = computed(() => (this.data.opponent ? (this.game.opponentState()?.userId ?? null) : null));

  /** "Enviar a…" for a Material or Recurso: the board's destinations, then what else can be done with it here. */
  protected async sendAttachment(parent: CardSlot, a: CardSlot, type: AttachmentType, i: number): Promise<void> {
    const card: SendToOption[] = [
      { id: 'swap', label: 'Intercambiar con la principal' },
      { id: 'reclassify', label: 'Pasar a ' + (type === 'materials' ? 'recursos' : 'materiales') },
    ];
    if (i > 0) card.push({ id: 'up', label: 'Subir' });
    if (i < parent[type].length - 1) card.push({ id: 'down', label: 'Bajar' });
    const id = await chooseSendTo(this.modal, {
      title: 'Enviar a…',
      subtitle: a.faceDown ? 'Carta oculta' : (a.cardName ?? undefined),
      groups: [
        { label: 'Zona', options: destinationOptions(null) },
        { label: ATTACH_LABELS[type], options: card },
      ],
    });
    if (!id) return;
    const to = destinationOf(id);
    if (to) this.moveOut(a, type, to);
    else if (id === 'swap') this.game.swapWithMain(a.instanceId, type, parent.instanceId, this.targetPlayer());
    else if (id === 'reclassify') this.game.reclassifyAttachment(a.instanceId, type, parent.instanceId, this.targetPlayer());
    else if (id === 'up') this.reorder(parent, type, i, -1);
    else if (id === 'down') this.reorder(parent, type, i, 1);
  }

  protected moveOut(a: CardSlot, type: AttachmentType, to: SendDestination): void {
    const parent = this.slot();
    if (!parent) return;
    this.game.moveFromAttachment({
      instanceId: a.instanceId,
      attachmentOf: parent.instanceId,
      attachmentType: type,
      toZone: to.zone,
      faceDown: to.faceDown,
      position: to.position ?? 'bottom',
      targetPlayerId: this.targetPlayer(),
    });
  }

  protected reorder(parent: CardSlot, type: AttachmentType, index: number, step: -1 | 1): void {
    const ids = parent[type].map((c) => c.instanceId);
    [ids[index], ids[index + step]] = [ids[index + step], ids[index]];
    this.game.reorderAttachment(parent.instanceId, type, ids, this.targetPlayer());
  }
}
