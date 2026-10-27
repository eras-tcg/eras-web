import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { ButtonComponent } from '../../primitives/button/button.component';
import { IconComponent } from '../../primitives/icon/icon.component';
import { CardImageComponent } from '../card-image/card-image.component';
import { ColorPipComponent } from '../color-pip/color-pip.component';

export interface CardFact {
  label: string;
  value: string;
  /** Spans the whole row (long text). */
  wide?: boolean;
}

export interface CardTextSegment {
  kind: 'text' | 'keyword' | 'note';
  text: string;
}

export interface CardTextLine {
  segments: CardTextSegment[];
  tags: string[];
}

export interface CardTextGroup {
  title: string;
  lines: CardTextLine[];
}

/**
 * Full view of one card: name, printing badges (with previous/next printing arrows),
 * facts, effect text and the image. Admin actions go into [detail-actions].
 */
@Component({
  selector: 'eras-card-detail',
  imports: [ButtonComponent, IconComponent, CardImageComponent, ColorPipComponent],
  templateUrl: './card-detail.component.html',
  styleUrl: './card-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.stacked]': 'stacked()' },
})
export class CardDetailComponent {
  /** Image on top and info below, for narrow containers (side panels). */
  readonly stacked = input(false, { transform: booleanAttribute });
  readonly name = input.required<string>();
  readonly edition = input.required<string>();
  readonly number = input<number | null>(null);
  readonly color = input<string | null>(null);
  readonly colorLabel = input<string | null>(null);
  readonly imageUrl = input<string | null>(null);
  readonly facts = input<CardFact[]>([]);
  readonly textGroups = input<CardTextGroup[]>([]);
  readonly notice = input<string | null>(null);
  readonly hasPreviousPrinting = input(false);
  readonly hasNextPrinting = input(false);
  /** Total printings of this name; arrows show only when > 1. */
  readonly printings = input(1);

  readonly previousPrinting = output<void>();
  readonly nextPrinting = output<void>();
}
