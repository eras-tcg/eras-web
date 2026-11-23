import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CardsStore } from '@data/cards/cards.store';
import { HomeStore } from '@data/home/home.store';
import { CardImageComponent } from '@ui/domain/card-image/card-image.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { HubSlide, hubSlides } from './hub-rules';
import { NewsDialogComponent } from './news-dialog.component';

/** A month of the log and its news, newest first. */
interface NewsMonth {
  label: string;
  items: HubSlide[];
}

/**
 * The news log (the bar's bell): every news item of the platform, newest first and by month, the carousel's and the
 * platform's history. A news item opens in full (NewsDialogComponent); an edition's announcement goes to its edition.
 */
@Component({
  selector: 'eras-news-log-dialog',
  imports: [ModalComponent, CardImageComponent],
  template: `
    <eras-modal
      title="Noticias"
      subtitle="Todo lo nuevo de ERAS, de lo más reciente a lo más antiguo"
      size="lg"
      (closed)="ref.close()"
    >
      @for (month of months(); track month.label) {
        <section class="month">
          <h3 class="month-label">{{ month.label }}</h3>
          <ul class="list">
            @for (item of month.items; track item.key) {
              <li>
                <button type="button" class="row" (click)="open(item)">
                  <span class="day">{{ item.eyebrow }}</span>
                  <span class="text">
                    <span class="title">{{ item.title }}</span>
                    @if (item.text) {
                      <span class="excerpt">{{ item.text }}</span>
                    }
                  </span>
                  <!-- Its picture: its cards whole and fanned (as on the carousel), or the vortex with the gem -->
                  @if (item.cards.length) {
                    <span
                      class="thumb fan"
                      [attr.data-count]="item.cards.length"
                      aria-hidden="true"
                    >
                      @for (card of item.cards; track card.id; let i = $index) {
                        <eras-card-image
                          class="fan-card"
                          [src]="card.imageUrl"
                          [alt]="''"
                          [style.--i]="i"
                        />
                      }
                    </span>
                  } @else {
                    <span class="thumb default" aria-hidden="true"></span>
                  }
                </button>
              </li>
            }
          </ul>
        </section>
      } @empty {
        <p class="empty">Sin noticias por ahora.</p>
      }
    </eras-modal>
  `,
  styles: `
    .month + .month {
      margin-block-start: var(--space-4);
    }
    .month-label {
      margin: 0 0 var(--space-2);
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .list {
      display: grid;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: grid;
      grid-template-columns: 5.5rem minmax(0, 1fr) 7rem;
      align-items: center;
      /* Every news item the same height, whatever its text */
      block-size: 5.5rem;
      overflow: hidden;
      gap: var(--space-3);
      inline-size: 100%;
      padding: var(--space-3);
      border: 0;
      border-radius: var(--radius-md);
      background: none;
      color: inherit;
      text-align: start;
      cursor: pointer;
    }
    .thumb {
      align-self: stretch;
      margin-block: calc(-1 * var(--space-3));
      margin-inline-end: calc(-1 * var(--space-3));
    }
    /* Its cards whole, fanned as on the carousel, as tall as the row lets them */
    .fan {
      --fan-card: 2.7rem;

      display: flex;
      align-items: center;
      justify-content: center;
    }
    .fan-card {
      inline-size: var(--fan-card);
      flex: none;
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-md);
      transform: rotate(calc((var(--i) - 1) * 9deg));
    }
    .fan-card + .fan-card {
      margin-inline-start: calc(var(--fan-card) * -0.45);
    }
    .fan[data-count='1'] .fan-card {
      transform: rotate(-4deg);
    }
    .fan[data-count='2'] .fan-card {
      transform: rotate(calc(var(--i) * 9deg - 4.5deg));
    }
    .fan[data-count='3'] .fan-card:nth-child(2) {
      z-index: 1;
      transform: translateY(-0.15rem) scale(1.06);
    }
    /* No picture: the carousel's vortex with the gem in its eye, fading into the row */
    .thumb.default {
      mask-image: linear-gradient(90deg, transparent, #000 45%);
      background:
        url('/favicon.svg') center / 2.4rem no-repeat,
        url('/images/vortex.webp') center / 8.5rem no-repeat;
    }
    .row:hover,
    .row:focus-visible {
      background: var(--color-surface-muted);
    }
    .day {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .text {
      display: grid;
      gap: var(--space-1);
      min-inline-size: 0;
    }
    .title {
      overflow: hidden;
      font-weight: var(--font-weight-bold);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .excerpt {
      display: -webkit-box;
      overflow: hidden;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .empty {
      margin: 0;
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsLogDialogComponent {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly home = inject(HomeStore);
  private readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly months = computed<NewsMonth[]>(() => {
    const months: NewsMonth[] = [];
    for (const slide of hubSlides(null, this.home.allNews(), this.cards.cards())) {
      const date = new Date(slide.date ?? '');
      const label = Number.isNaN(date.getTime())
        ? 'Sin fecha'
        : new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(date);
      const last = months.at(-1);
      if (last?.label === label) last.items.push(slide);
      else months.push({ label, items: [slide] });
    }
    return months;
  });

  constructor() {
    void this.home.load();
    void this.cards.load();
  }

  /** A news item in full; an edition's announcement goes to its edition (the log closes on leaving). */
  protected async open(item: HubSlide): Promise<void> {
    const url =
      item.link ??
      (await firstValueFrom(
        this.modal.open<string, HubSlide>(NewsDialogComponent, { data: item }).closed,
      ));
    if (!url) return;
    this.ref.close();
    void this.router.navigateByUrl(url);
  }
}
