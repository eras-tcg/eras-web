import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardBackService, cardBackOf } from '@core/theme/card-back.service';
import { CardArtViewerComponent, CardArtViewerData } from '@ui/domain/card-art-viewer/card-art-viewer.component';
import { CardImageComponent } from '@ui/domain/card-image/card-image.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { DetailFrameComponent } from '@ui/surfaces/detail-frame/detail-frame.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';

/**
 * Chooses the card back, in the frame of the card's detail (one size whatever is shown, so turning the card never
 * moves it): the back looked at in large, as tall as the panel (it leans toward the pointer; a click opens it in the
 * 3D viewer), and beside it every back to look at and "Usar este reverso" to keep it.
 */
@Component({
  selector: 'eras-card-back-dialog',
  imports: [DetailFrameComponent, CardImageComponent, ButtonComponent],
  template: `
    <eras-detail-frame (closed)="ref.close()">
      <div class="body">
        <button type="button" class="large" aria-label="Ver el reverso en pantalla completa" (click)="openViewer()">
          <eras-card-image [src]="seen().src" [alt]="seen().name" noShine live eager />
        </button>
        <div class="side">
          <h2 class="name">{{ seen().name }}</h2>
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
                <span>{{ back.name }}</span>
              </button>
            }
          </div>
          <button erasButton type="button" class="use" [disabled]="seen().id === cardBack.id()" (click)="use()">
            {{ seen().id === cardBack.id() ? 'En uso' : 'Usar este reverso' }}
          </button>
        </div>
      </div>
    </eras-detail-frame>
  `,
  styles: `
    /* The frame's panel holds the body whole: the large back takes its height, the list the rest of the width */
    .body {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--space-6);
      block-size: 100%;
    }
    .large {
      block-size: 100%;
      aspect-ratio: 63 / 88;
      padding: 0;
      border: 0;
      border-radius: var(--radius-card);
      background: none;
      cursor: zoom-in;
    }
    .large eras-card-image { block-size: 100%; }
    .large:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
    .side { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); min-block-size: 0; overflow-y: auto; }
    .name { margin: 0; font-family: var(--font-family-display); font-size: var(--font-size-2xl); font-weight: var(--font-weight-regular); }
    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
      gap: var(--space-3);
      inline-size: 100%;
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
    /* A phone held upright: the large back over the list, as wide as the panel lets it */
    @media (orientation: portrait) and (max-width: 44rem) {
      .body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
      .large { justify-self: center; block-size: 100%; max-inline-size: 100%; }
      .side { overflow: visible; }
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
  protected readonly seen = computed(() => cardBackOf(this.seenId()));

  protected use(): void {
    this.cardBack.id.set(this.seenId());
  }

  protected openViewer(): void {
    const data: CardArtViewerData = { src: this.seen().src, alt: this.seen().name, noGloss: true };
    this.modal.open(CardArtViewerComponent, { data, maxWidth: '100vw', maxHeight: '100dvh' });
  }
}

/** Opens the card backs, to choose one. */
export function openCardBackDialog(modal: ModalService): void {
  modal.open(CardBackDialogComponent);
}
