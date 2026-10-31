import { Injectable, signal } from '@angular/core';
import { ZoneName } from '@data/simulator/simulator.model';

export interface DraggedCard {
  instanceId: string;
  fromZone: ZoneName;
  /** One of your creatures that can attack now: dropped on an enemy creature, the rival's lives or hand, it attacks. */
  attack?: boolean;
}

const DRAG_TYPE = 'application/x-eras-slot';

/** Card being dragged on the board (one per board page). */
@Injectable()
export class BoardDrag {
  readonly dragging = signal<DraggedCard | null>(null);

  start(event: DragEvent, card: DraggedCard): void {
    this.dragging.set(card);
    event.dataTransfer?.setData(DRAG_TYPE, JSON.stringify(card));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  end(): void {
    this.dragging.set(null);
  }

  /** True while a board card is over a drop target (call preventDefault to allow the drop). */
  accepts(event: DragEvent): boolean {
    return !!event.dataTransfer?.types.includes(DRAG_TYPE);
  }

  read(event: DragEvent): DraggedCard | null {
    const raw = event.dataTransfer?.getData(DRAG_TYPE);
    this.dragging.set(null);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DraggedCard;
    } catch {
      return null;
    }
  }

  /** Drop position in % of the element (x, y), from the owner's point of view. */
  position(event: DragEvent, element: HTMLElement, mirrored = false): { x: number; y: number } {
    const rect = element.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, mirrored ? 100 - y : y)) };
  }
}
