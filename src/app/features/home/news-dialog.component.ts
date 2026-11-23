import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardImageComponent } from '@ui/domain/card-image/card-image.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { HubSlide } from './hub-rules';

/**
 * A news item of the hub's carousel in full, as a pop-up: its day, the news told at length (its paragraphs) and its
 * cards (none: the carousel's turning vortex and the gem on the right, fading into the text); its button, when it has one, closes with the URL to go to. A click outside (or Esc, or ✕) closes it.
 */
@Component({
  selector: 'eras-news-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent, CardImageComponent],
  template: `
    <eras-modal
      [title]="news.title"
      [subtitle]="news.eyebrow"
      size="xl"
      [class.with-back]="!news.cards.length"
      (closed)="ref.close()"
    >
      @if (!news.cards.length) {
        <div class="backdrop" aria-hidden="true">
          <span class="vortex"></span><span class="gem"></span>
        </div>
      }
      <!-- A fixed space for the news, so the pop-up is always as tall and its button always at its foot -->
      <div class="content">
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
      </div>
      @if (news.action; as action) {
        <ng-container modal-footer>
          <button erasButton type="button" (click)="ref.close(action.url)">
            {{ action.label }} <eras-icon name="chevron-right" />
          </button>
        </ng-container>
      }
    </eras-modal>
  `,
  styles: `
    .story {
      display: grid;
      gap: var(--space-4);
      max-inline-size: 60ch;
      font-size: var(--font-size-lg);
      line-height: 1.6;
    }
    .story p {
      margin: 0;
    }
    /*
     * A news item without cards: the carousel's vortex (vortex.webp, the card back's) on the right, larger than the
     * panel and turning slowly as on the carousel, the ERAS gem still in its eye (0.29 of the vortex); the whole fades
     * out towards the text, into the panel. Under the content: the panel isolates it.
     */
    eras-modal.with-back {
      position: relative;
      isolation: isolate;
      overflow: hidden;
    }
    .backdrop {
      --vortex: 46rem;

      position: absolute;
      z-index: -1;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      mask-image: linear-gradient(90deg, transparent 30%, #000 68%);
    }
    .vortex,
    .gem {
      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 74%;
      translate: -50% -50%;
    }
    .vortex {
      inline-size: var(--vortex);
      block-size: var(--vortex);
      background: url('/images/vortex.webp') center / contain no-repeat;
      animation: news-vortex-turn 90s linear infinite;
    }
    .gem {
      inline-size: calc(var(--vortex) * 0.29);
      block-size: calc(var(--vortex) * 0.29);
      background: url('/favicon.svg') center / contain no-repeat;
    }
    @keyframes news-vortex-turn {
      to {
        rotate: -360deg;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .vortex {
        animation: none;
      }
    }
    eras-modal.with-back .story {
      max-inline-size: min(60ch, 50%);
    }
    /* A narrow screen keeps the whole width for the text */
    @media (max-width: 40rem) {
      .content {
        block-size: auto;
      }
      .backdrop {
        display: none;
      }
      eras-modal.with-back .story {
        max-inline-size: none;
      }
    }
    .content {
      block-size: min(24rem, calc(100vh - 14rem));
      overflow-y: auto;
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
