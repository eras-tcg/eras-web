import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { missionGuide, MissionGuide } from './mission-guide';
import { MissionGuideDialogComponent } from './mission-guide-dialog.component';

/**
 * The way from a "Bienvenida" step (its «Ir» in Misiones, or the home's «Siguiente paso») to its section: opens
 * the section and then tells what it is for. Reaching the section any other way shows nothing.
 */
@Injectable({ providedIn: 'root' })
export class MissionGuideFlow {
  private readonly router = inject(Router);
  private readonly modal = inject(ModalService);

  async open(stepId: string, route: string): Promise<void> {
    const arrived = await this.router.navigateByUrl(route);
    const guide = missionGuide(stepId);
    if (arrived && guide) this.modal.open<void, MissionGuide>(MissionGuideDialogComponent, { data: guide });
  }
}
