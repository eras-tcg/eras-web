import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardImageComponent } from '@ui/domain/card-image/card-image.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { HubSlide } from './hub-rules';

/**
 * A news item of the hub's carousel in full, as a pop-up: its day, the news told at length (its paragraphs) and its
 * cards (none: the player's card back on the right, fading into the text); its button, when it has one, closes with the URL to go to. A click outside (or Esc, or ✕) closes it.
 */
@Component({
  selector: 'eras-news-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent, CardImageComponent],
  template: `
    <eras-modal [title]="news.title" [subtitle]="news.eyebrow" size="xl" [class.with-back]="!news.cards.length" (closed)="ref.close()">
      <div class="story">
        @for (p of paragraphs; track $index) {
          <p>{{ p }}</p>
        }
      </div>
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
    .story { display: grid; gap: var(--space-4); max-inline-size: 60ch; font-size: var(--font-size-lg); line-height: 1.6; }
    .story p { margin: 0; }
    /* A news item without cards: the card back on the right, fading into the panel behind the text */
    eras-modal.with-back {
      min-block-size: min(32rem, calc(100vh - 2 * var(--space-6)));
      background:
        linear-gradient(90deg, var(--color-surface) 48%, color-mix(in srgb, var(--color-surface) 70%, transparent) 62%, transparent 82%),
        var(--card-back-image, url('/images/card-back.png')) right center / auto 100% no-repeat,
        var(--color-surface);
    }
    eras-modal.with-back .story { max-inline-size: min(60ch, 58%); }
    /* A narrow screen keeps the whole width for the text */
    @media (max-width: 40rem) {
      eras-modal.with-back { min-block-size: 0; background: var(--color-surface); }
      eras-modal.with-back .story { max-inline-size: none; }
    }
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
  /** The news told in full, a paragraph per block (apart by a blank line). */
  protected readonly paragraphs = this.news.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
