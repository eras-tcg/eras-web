import { WheelScrollXDirective } from '@ui/primitives/wheel-scroll/wheel-scroll.directive';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { CardSlot, EffectPrompt } from '@data/simulator/simulator.model';
import { NgTemplateOutlet } from '@angular/common';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { ZoneBoxComponent } from '@ui/domain/zone-box/zone-box.component';
import { CardPeekComponent } from '../card-peek.component';
import { HOME, MeasuredItem, entryLayout, entrySpots, homePlace, readPlace, spotAt } from '../formation-entry';

/** A press on the entering creature must move this far to lift it (less is a tap). */
const LIFT_PX = 5;
/** Near this many pixels from an end of the row, the dragged creature scrolls it. */
const EDGE_PX = 56;
/** The fastest the row scrolls by itself, in pixels a frame. */
const EDGE_SPEED = 14;

/**
 * Enlace: the Línea frontal of a creature that entered it (FORMATION_ENTRY), its formations boxed as the zones of a choice. The
 * entering creature is dragged (mouse, finger or pen) to a gap (alone) or to a side of a creature (linking with it: its formation,
 * or a new one); only the engine's options take it, and it shows where it would go. While it is dragged it leaves the row, so
 * every place offered is among the others (none next to itself). The row scrolls sideways (wheel, bar, swipe anywhere but on the
 * entering creature) and by itself while dragging near its ends.
 */
@Component({
  selector: 'eras-formation-entry',
  imports: [WheelScrollXDirective, GameCardComponent, CardPeekComponent, NgTemplateOutlet, ZoneBoxComponent],
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
    // Lifted, it is out of the row: no place next to itself
    const place = this.dragging() ? { gap: -1, withId: null } : (readPlace(this.choice()) ?? this.home());
    const home = this.home();
    return entryLayout(p.cards, p.subjectId ?? '', this.formations(), p.validIds, place, home.withId ? null : home.gap);
  });

  /** The option under the dragged creature (null: none there). */
  protected readonly hover = signal<string | null>(null);
  /** The creature lifted: where it is drawn while it follows the pointer (in the row's frame). */
  protected readonly ghost = signal<{ x: number; y: number } | null>(null);
  /** The entering creature is lifted (out of the row). */
  private readonly dragging = signal(false);

  private press: { id: number; x0: number; y0: number; grabX: number; grabY: number; x: number; y: number } | null = null;
  private frame = 0;

  // Followed on the document: the creature leaves the row once lifted (its element goes away)
  private readonly onMove = (e: PointerEvent) => this.move(e);
  private readonly onUp = (e: PointerEvent) => this.up(e);
  private readonly onCancel = () => this.stop();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected name(c: CardSlot | null): string {
    return c?.cardName ?? 'Carta';
  }

  // ------------------------------------------------------------------ Dragging the entering creature

  protected down(e: PointerEvent): void {
    if (this.disabled() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    // No text selection nor the browser's own drag of the image
    e.preventDefault();
    document.addEventListener('pointermove', this.onMove);
    document.addEventListener('pointerup', this.onUp);
    document.addEventListener('pointercancel', this.onCancel);
    this.press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, grabX: e.clientX - rect.left, grabY: e.clientY - rect.top, x: e.clientX, y: e.clientY };
  }

  private move(e: PointerEvent): void {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!this.ghost()) {
      if (Math.hypot(p.x - p.x0, p.y - p.y0) < LIFT_PX) return;
      this.dragging.set(true);
      this.frame = requestAnimationFrame(() => this.edgeScroll());
    }
    this.follow();
  }

  private up(e: PointerEvent): void {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    const target = this.ghost() ? this.hover() : null;
    this.stop();
    // Dropped back where it stands: no choice (it stays, without linking)
    if (target) this.choice.set(target === HOME || target === `pos:${this.home().gap}` ? null : target);
  }

  private stop(): void {
    document.removeEventListener('pointermove', this.onMove);
    document.removeEventListener('pointerup', this.onUp);
    document.removeEventListener('pointercancel', this.onCancel);
    this.press = null;
    this.dragging.set(false);
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
    const row = this.row().nativeElement;
    // Over the row: the option of the stretch under the pointer (each place reaches its neighbours, no hole between them)
    const r = row.getBoundingClientRect();
    if (p.y < r.top || p.y > r.bottom || p.x < r.left || p.x > r.right) {
      this.hover.set(null);
      return;
    }
    this.hover.set(spotAt(entrySpots(this.measured(row)), p.x));
  }

  /** The row's gaps and groups as they are on the screen now, left to right. */
  private measured(row: HTMLElement): MeasuredItem[] {
    const items: MeasuredItem[] = [];
    for (const el of Array.from(row.children) as HTMLElement[]) {
      const b = el.getBoundingClientRect();
      if (el.classList.contains('gap')) {
        items.push({ kind: 'gap', target: el.dataset['target'] ?? null, left: b.left, right: b.right });
      } else if (el.classList.contains('zone-box')) {
        const cards = Array.from(el.querySelectorAll<HTMLElement>('.member')).map((m) => {
          const c = m.getBoundingClientRect();
          const side = (s: string) => m.querySelector<HTMLElement>(`:scope > .half.${s}`)?.dataset['target'] ?? null;
          return { left: c.left, right: c.right, leftTarget: side('left'), rightTarget: side('right') };
        });
        items.push({ kind: 'group', boxed: el.classList.contains('boxed'), left: b.left, right: b.right, cards });
      }
    }
    return items;
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

}
