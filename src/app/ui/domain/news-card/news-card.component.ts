import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardComponent } from '../../surfaces/card/card.component';

@Component({
  selector: 'eras-news-card',
  // `title` is an input: without this, a static title="…" also stays on the host as the browser's tooltip
  host: { '[attr.title]': 'null' },
  imports: [CardComponent],
  template: `
    <eras-card>
      <article class="news">
        <time class="date" [attr.datetime]="date()">{{ dateLabel() }}</time>
        <h3 class="title">{{ title() }}</h3>
        <p class="excerpt">{{ excerpt() }}</p>
      </article>
    </eras-card>
  `,
  styles: `
    :host { display: block; }
    eras-card { block-size: 100%; }
    .news { display: flex; flex-direction: column; gap: var(--space-2); }
    .date {
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .title { font-family: var(--font-family-base); font-size: var(--font-size-md); font-weight: var(--font-weight-bold); }
    .excerpt { color: var(--color-text-muted); font-size: var(--font-size-sm); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsCardComponent {
  /** ISO date (YYYY-MM-DD). */
  readonly date = input.required<string>();
  readonly dateLabel = input.required<string>();
  readonly title = input.required<string>();
  readonly excerpt = input.required<string>();
}
