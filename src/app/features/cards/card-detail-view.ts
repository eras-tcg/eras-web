import { CARD_TYPE_LABELS, COLOR_LABELS, CardRefData, CatalogCard, SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { cardImageUrl, fullEditionId, renderEffect, renderKeywordEffect } from '@data/cards/card-rules';
import { CardFact, CardTextGroup } from '@ui/domain/card-detail/card-detail.component';

export interface CardDetailView {
  name: string;
  edition: string;
  number: number | null;
  color: string | null;
  colorLabel: string | null;
  imageUrl: string | null;
  facts: CardFact[];
  groups: CardTextGroup[];
  notice: string | null;
}

/**
 * Inputs of `<eras-card-detail>` for a catalog card. {@code unprogrammed}: what of its metadata the simulator does not
 * run yet (null when everything is programmed).
 */
export function cardDetailView(card: CatalogCard, ref: CardRefData | null, unprogrammed: string | null = null): CardDetailView {
  const meta = card.meta;
  const facts: CardFact[] = [];
  const add = (label: string, value: unknown, wide = false) => {
    if (value !== null && value !== undefined && value !== '') facts.push({ label, value: String(value), wide });
  };
  if (meta) {
    add('Tipo de carta', meta.cardType ? (CARD_TYPE_LABELS[meta.cardType] ?? meta.cardType) : null);
    add('Coste', meta.cost);
    add('Fuerza', meta.strength);
    add('Nivel', meta.level);
    add('Iniciador', meta.starter ? 'Sí' : null);
    add('Clases', meta.cardClasses?.join(', '));
    add('Regulación', meta.regulation);
    add('Coste especial', meta.specialCost);
    add('Invocación especial', meta.specialSummonKind ? (SPECIAL_SUMMON_LABELS[meta.specialSummonKind] ?? meta.specialSummonKind) : null);
    add('Rareza', meta.rarity);
    add('Colores', meta.colors?.map((c) => COLOR_LABELS[c] ?? c).join(', '));
    add('Requerimiento', meta.requirement, true);
  }
  const groups: CardTextGroup[] = meta
    ? [
        {
          title: 'Efectos',
          lines: [...(meta.effects ?? []).map((e) => renderEffect(e, ref)), ...(meta.keywordEffects ?? []).map((k) => renderKeywordEffect(k, ref))],
        },
        {
          title: 'Efectos heredados',
          lines: [...(meta.inheritEffects ?? []).map((e) => renderEffect(e, ref)), ...(meta.inheritKeywordEffects ?? []).map((k) => renderKeywordEffect(k, ref))],
        },
      ]
    : [];
  return {
    name: card.name ?? '—',
    edition: fullEditionId(card),
    number: card.number,
    color: card.color_identity,
    colorLabel: card.color_identity ? (COLOR_LABELS[card.color_identity] ?? card.color_identity) : null,
    imageUrl: cardImageUrl(card),
    facts,
    groups,
    notice: !meta
      ? 'Esta carta todavía no tiene metadatos.'
      : unprogrammed
        ? `Esta carta todavía no se puede jugar en el simulador: falta programar ${unprogrammed}. Un mazo que la tenga no se puede elegir en una partida.`
        : null,
  };
}
