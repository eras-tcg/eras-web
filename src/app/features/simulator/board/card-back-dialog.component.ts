import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardBack, CardBackService } from '@core/theme/card-back.service';
import { CardArtViewerComponent, CardArtViewerData } from '@ui/domain/card-art-viewer/card-art-viewer.component';
import { CardImageComponent } from '@ui/domain/card-image/card-image.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';

/**
 * Chooses the card back: the one looked at in large (it leans toward the pointer; a click opens it in the 3D viewer,
 * as a card of the catalog) beside every back to choose from. ←/→ walk through them; "Usar este reverso" keeps it.
 */
@Component({
  selector: 'eras-card-back-dialog',
  imports: [ModalComponent, CardImageComponent, ButtonComponent],
  template: `
    <eras-modal title="Reverso de las cartas" size="lg" (closed)="ref.close()">
      <div class="body" (keydown.arrowleft)="step(-1)" (keydown.arrowright)="step(1)" tabindex="-1">
        <button type="button" class="large" [attr.aria-label]="'Ver ' + seen().name + ' en detalle'" (click)="openViewer()">
          <eras-card-image [src]="seen().src" [alt]="seen().name" noShine live eager />
        </button>
        <div class="side">
          <h3 class="name">{{ seen().name }}</h3>
          <div class="list" role="listbox" aria-label="Reversos">
            @for (back of backs; track back.id) {
              <button
                type="button"
                role="option"
                class="option"
                [class.seen]="back.id === seen().id"
                [attr.aria-selected]="back.id === seen().id"
                (click)="seenId.set(back.id)"
              >
                <eras-card-image [src]="back.src" [alt]="back.name" noShine />
                <span class="label">{{ back.name }}</span>
              </button>
            }
          </div>
        </div>
      </div>
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cerrar</button>
        <button erasButton type="button" [disabled]="seen().id === cardBack.id()" (click)="use()">
          {{ seen().id === cardBack.id() ? 'En uso' : 'Usar este reverso' }}
        </button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--space-5);
      align-items: start;
      outline: none;
    }
    .large {
      display: block;
      inline-size: min(100%, 22rem);
      justify-self: center;
      padding: 0;
      border: 0;
      border-radius: var(--radius-card);
      background: none;
      cursor: zoom-in;
    }
    .large:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
    .side { display: flex; flex-direction: column; gap: var(--space-3); min-inline-size: 0; }
    .name { margin: 0; font-family: var(--font-family-display); font-size: var(--font-size-xl); font-weight: var(--font-weight-regular); }
    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
      gap: var(--space-3);
    }
    .option {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-1);
      border: 2px solid transparent;
      border-radius: var(--radius-md);
      background: none;
      color: var(--color-text);
      font: inherit;
      font-size: var(--font-size-sm);
      text-align: center;
      cursor: pointer;
    }
    .option:hover { background: var(--color-surface-muted); }
    .option.seen { border-color: var(--color-primary); }
    .option:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    @media (max-width: 40rem) {
      .body { grid-template-columns: 1fr; }
      .large { inline-size: min(100%, 15rem); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardBackDialogComponent {
  protected readonly ref = inject(DialogRef);
  protected readonly cardBack = inject(CardBackService);
  private readonly modal = inject(ModalService);
  protected readonly backs = this.cardBack.backs;

  /** The back looked at: the one in use until another is clicked. */
  protected readonly seenId = signal(this.cardBack.id());
  protected readonly seen = computed<CardBack>(() => this.backs.find((b) => b.id === this.seenId()) ?? this.backs[0]);

  protected step(delta: number): void {
    const i = this.backs.findIndex((b) => b.id === this.seenId());
    this.seenId.set(this.backs[(i + delta + this.backs.length) % this.backs.length].id);
  }

  protected use(): void {
    this.cardBack.id.set(this.seenId());
  }

  protected openViewer(): void {
    const data: CardArtViewerData = { src: this.seen().src, alt: this.seen().name, noGloss: true };
    this.modal.open(CardArtViewerComponent, { data, maxWidth: '100vw', maxHeight: '100dvh' });
  }
}

/** Opens the card back's chooser. */
export function openCardBackDialog(modal: ModalService): void {
  modal.open(CardBackDialogComponent);
}
