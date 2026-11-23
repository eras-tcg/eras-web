import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardImageComponent } from '@ui/domain/card-image/card-image.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { HubSlide } from './hub-rules';

/**
 * A news item of the hub's carousel in full, as a pop-up: its day, its text whole and its cards; its button, when it
 * has one, closes with the URL to go to. A click outside (or Esc, or ✕) closes it.
 */
@Component({
  selector: 'eras-news-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent, CardImageComponent],
  template: `
    <eras-modal [title]="news.title" [subtitle]="news.eyebrow" size="lg" (closed)="ref.close()">
      @if (news.text) {
        <p class="text">{{ news.text }}</p>
      }
      @if (news.cards.length) {
        <div class="cards">
          @for (card of news.cards; track card.id) {
            <eras-card-image [src]="card.imageUrl" [alt]="card.name" eager />
          }
        </div>
      }
      @if (news.action; as action) {
        <ng-container modal-footer>
          <button erasButton type="button" (click)="ref.close(action.url)">{{ action.label }} <eras-icon name="chevron-right" /></button>
        </ng-container>
      }
    </eras-modal>
  `,
  styles: `
    .text { margin: 0; white-space: pre-line; line-height: 1.6; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(8rem, 12rem));
      justify-content: center;
      gap: var(--space-4);
      margin-block-start: var(--space-5);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsDialogComponent {
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly news = inject<HubSlide>(DIALOG_DATA);
}
