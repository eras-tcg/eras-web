import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProgressionBoard } from '@core/missions/progression.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { StructurePickerData, StructurePickerDialogComponent } from './structure-picker-dialog.component';

const WIDTH = 'min(64rem, 96vw)';

/**
 * The first step of the "Bienvenida", told rather than only paid: the greeting leads straight to choosing one of
 * ST1–ST4 (free: the first of them), which then opens on the booster result page. The home greets a player who has
 * not taken one yet, once per visit to the site.
 */
@Injectable({ providedIn: 'root' })
export class WelcomeFlow {
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  private greeted = false;

  /** Greets once, when the board says the first step (taking one of ST1–ST4) is not done yet. */
  greetIfNew(board: ProgressionBoard | null): void {
    if (this.greeted || !board) return;
    const first = board.welcome[0];
    if (!first || first.claimed || first.progress >= first.target) return;
    this.greeted = true;
    void this.start();
  }

  /** The greeting, which turns into the structure deck picker in the same dialog. */
  async start(): Promise<void> {
    this.greeted = true;
    await this.pickStructure({ greet: true });
  }

  /** Both again from "Progreso", only to look at: no deck is taken. */
  async replay(): Promise<void> {
    const data: StructurePickerData = { greet: true, replay: true };
    this.modal.open(StructurePickerDialogComponent, { width: WIDTH, data });
  }

  /** The structure deck picker; the deck chosen opens on the booster result page. */
  async pickStructure(data: StructurePickerData = {}): Promise<void> {
    const editionId = await firstValueFrom(this.modal.open<string>(StructurePickerDialogComponent, { width: WIDTH, data }).closed);
    if (editionId) await this.router.navigate(['/booster-result'], { queryParams: { edition: editionId, mode: 'structure' } });
  }
}
