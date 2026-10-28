import { Injectable, signal } from '@angular/core';

/** Whether an open sheet is lowered: the page behind can be looked at (cards, zones) but not used. */
@Injectable({ providedIn: 'root' })
export class SheetState {
  readonly lowered = signal(false);
}
