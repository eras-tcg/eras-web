import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProgressionBoard } from '@core/missions/progression.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { StructurePickerDialogComponent } from './structure-picker-dialog.component';
import { WelcomeDialogComponent } from './welcome-dialog.component';

/**
 * The first steps of the "Bienvenida", told rather than only paid: the greeting (which claims the first step) leads
 * straight to choosing the structure deck, which then opens on the booster result page. The home greets a player
 * whose first step is unclaimed once per visit to the site.
 */
@Injectable({ providedIn: 'root' })
export class WelcomeFlow {
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  private greeted = false;

  /** Greets once, when the board says the first step is still unclaimed. */
  greetIfNew(board: ProgressionBoard | null): void {
    if (this.greeted || !board) return;
    const first = board.welcome[0];
    if (!first || first.claimed) return;
    this.greeted = true;
    void this.start();
  }

  /** The greeting, then the structure deck picker. */
  async start(): Promise<void> {
    this.greeted = true;
    const next = await firstValueFrom(this.modal.open<'pick'>(WelcomeDialogComponent, { width: 'min(40rem, 96vw)' }).closed);
    if (next === 'pick') await this.pickStructure();
  }

  /** Both again from "Progreso", only to look at: nothing is claimed and no deck is given. */
  async replay(): Promise<void> {
    const data = { replay: true };
    const next = await firstValueFrom(this.modal.open<'pick'>(WelcomeDialogComponent, { width: 'min(40rem, 96vw)', data }).closed);
    if (next === 'pick') this.modal.open(StructurePickerDialogComponent, { width: 'min(64rem, 96vw)', data });
  }

  /** The structure deck picker; the deck chosen opens on the booster result page. */
  async pickStructure(): Promise<void> {
    const editionId = await firstValueFrom(this.modal.open<string>(StructurePickerDialogComponent, { width: 'min(64rem, 96vw)' }).closed);
    if (editionId) await this.router.navigate(['/booster-result'], { queryParams: { edition: editionId, mode: 'structure' } });
  }
}
