import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { CardSlot, EffectPrompt } from '@data/simulator/simulator.model';
import { NgTemplateOutlet } from '@angular/common';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { CardPeekComponent } from '../card-peek.component';
import { entryLayout, homePlace, readPlace } from '../formation-entry';

/** A press on the entering creature must move this far to lift it (less is a tap). */
const LIFT_PX = 5;
/** Near this many pixels from an end of the row, the dragged creature scrolls it. */
const EDGE_PX = 56;
/** The fastest the row scrolls by itself, in pixels a frame. */
const EDGE_SPEED = 14;

/**
 * Enlace: the Línea frontal of a creature that entered it (FORMATION_ENTRY), its formations boxed as the zones of a choice. The
 * entering creature is dragged (mouse, finger or pen) to a gap (alone) or to a side of a creature (linking with it: its formation,
 * or a new one); only the engine's options take it, and it shows where it would go. Every target is a button too (keyboard).
 * The row scrolls sideways (wheel, bar, swipe anywhere but on the entering creature) and by itself while dragging near its ends.
 */
@Component({
  selector: 'eras-formation-entry',
  imports: [GameCardComponent, IconComponent, CardPeekComponent, NgTemplateOutlet],
  templateUrl: './formation-entry.component.html',
  styleUrl: './formation-entry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormationEntryComponent {
  readonly prompt = input.required<EffectPrompt>();
  /** The player's formations now (instance ids of their members). */
  readonly formations = input<readonly (readonly string[])[]>([]);
  readonly disabled = input(false);
  /** The option chosen ("pos:i" or "pos:i:id"), null: where it stands. */
  readonly choice = model<string | null>(null);

  private readonly row = viewChild.required<ElementRef<HTMLElement>>('row');
  private readonly wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');

  protected readonly subject = computed(() => this.prompt().cards.find((c) => c.instanceId === this.prompt().subjectId) ?? null);
  private readonly home = computed(() => homePlace(this.prompt().cards, this.prompt().subjectId ?? '', this.formations()));
  protected readonly layout = computed(() => {
    const p = this.prompt();
    const place = readPlace(this.choice()) ?? this.home();
    return entryLayout(p.cards, p.subjectId ?? '', this.formations(), p.validIds, place);
  });

  /** The option under the dragged creature (null: none there). */
  protected readonly hover = signal<string | null>(null);
  /** The creature lifted: where it is drawn while it follows the pointer (in the row's frame). */
  protected readonly ghost = signal<{ x: number; y: number } | null>(null);

  private press: { id: number; x0: number; y0: number; grabX: number; grabY: number; x: number; y: number } | null = null;
  private frame = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  protected label(option: string): string {
    return this.prompt().cardLabels?.[option] ?? option;
  }

  protected name(c: CardSlot | null): string {
    return c?.cardName ?? 'Carta';
  }

  /** A target tapped or pressed with the keyboard: it goes there; the chosen one again, back to where it stands. */
  protected pick(option: string): void {
    if (this.disabled()) return;
    this.choice.set(this.choice() === option ? null : option);
  }

  // ------------------------------------------------------------------ Dragging the entering creature

  protected down(e: PointerEvent): void {
    if (this.disabled() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    // No text selection nor the browser's own drag of the image
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    this.press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, grabX: e.clientX - rect.left, grabY: e.clientY - rect.top, x: e.clientX, y: e.clientY };
  }

  protected move(e: PointerEvent): void {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!this.ghost()) {
      if (Math.hypot(p.x - p.x0, p.y - p.y0) < LIFT_PX) return;
      this.frame = requestAnimationFrame(() => this.edgeScroll());
    }
    this.follow();
  }

  protected up(e: PointerEvent): void {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    const target = this.ghost() ? this.hover() : null;
    this.stop();
    if (target) this.choice.set(target);
  }

  protected stop(): void {
    this.press = null;
    cancelAnimationFrame(this.frame);
    this.ghost.set(null);
    this.hover.set(null);
  }

  /** The lifted creature under the pointer, and the option there. */
  private follow(): void {
    const p = this.press;
    if (!p) return;
    const frame = this.wrap().nativeElement.getBoundingClientRect();
    this.ghost.set({ x: p.x - frame.left - p.grabX, y: p.y - frame.top - p.grabY });
    const under = document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>('[data-target]');
    this.hover.set(under && this.row().nativeElement.contains(under) ? (under.dataset['target'] ?? null) : null);
  }

  /** Near an end of the row, it scrolls that way (faster the nearer), every frame while the creature is lifted. */
  private edgeScroll(): void {
    const p = this.press;
    if (!p) return;
    const row = this.row().nativeElement;
    const r = row.getBoundingClientRect();
    const toStart = p.x - r.left;
    const toEnd = r.right - p.x;
    const speed = toStart < EDGE_PX ? -EDGE_SPEED * (1 - Math.max(0, toStart) / EDGE_PX) : toEnd < EDGE_PX ? EDGE_SPEED * (1 - Math.max(0, toEnd) / EDGE_PX) : 0;
    if (speed) {
      const before = row.scrollLeft;
      row.scrollLeft += speed;
      if (row.scrollLeft !== before) this.follow();
    }
    this.frame = requestAnimationFrame(() => this.edgeScroll());
  }

  /** The mouse wheel up or down scrolls the row sideways. */
  protected wheel(e: WheelEvent): void {
    const row = this.row().nativeElement;
    if (row.scrollWidth <= row.clientWidth || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    e.preventDefault();
    row.scrollLeft += e.deltaY;
  }
}
