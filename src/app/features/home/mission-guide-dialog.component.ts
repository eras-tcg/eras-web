import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { MissionGuide } from './mission-guide';

/** What the section just opened from a "Bienvenida" step is for, and what completes that step. */
@Component({
  selector: 'eras-mission-guide-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal [title]="guide.title" (closed)="ref.close()">
      <div class="head">
        <span class="emblem" aria-hidden="true"><eras-icon [name]="guide.icon" /></span>
        <p class="intro">{{ guide.intro }}</p>
      </div>
      <ul class="points">
        @for (point of guide.points; track point) {
          <li><eras-icon name="check" /> <span>{{ point }}</span></li>
        }
      </ul>
      <p class="goal"><eras-icon name="target" /> <span>{{ guide.goal }}</span></p>
      <ng-container modal-footer>
        <button erasButton type="button" (click)="ref.close()">Entendido</button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .head { display: flex; align-items: center; gap: var(--space-3); margin-block-end: var(--space-3); }
    .emblem {
      display: grid;
      flex-shrink: 0;
      place-items: center;
      inline-size: 3rem;
      block-size: 3rem;
      border-radius: 50%;
      background: color-mix(in srgb, var(--color-hub-accent) 18%, transparent);
      color: var(--color-hub-accent);
      animation: pop 420ms cubic-bezier(0.2, 0.8, 0.2, 1.4) both;
    }
    .emblem eras-icon { inline-size: 1.5rem; block-size: 1.5rem; }
    @keyframes pop {
      from { opacity: 0; transform: scale(0.6); }
    }
    @media (prefers-reduced-motion: reduce) { .emblem { animation: none; } }
    .intro { margin: 0; line-height: 1.5; }
    .points { display: grid; gap: var(--space-2); margin: 0 0 var(--space-3); padding: 0; list-style: none; }
    .points li, .goal { display: flex; align-items: flex-start; gap: var(--space-2); color: var(--color-text-muted); }
    .points eras-icon, .goal eras-icon { flex-shrink: 0; inline-size: 1.1rem; block-size: 1.1rem; margin-block-start: 0.15em; color: var(--color-hub-accent); }
    .goal { margin: 0; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--color-surface-muted); color: var(--color-text); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissionGuideDialogComponent {
  protected readonly guide = inject<MissionGuide>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
}
