import { ChangeDetectionStrategy, Component } from '@angular/core';
import { APP_VERSION } from './app-version';

/** The web's version in very small text (the home, the login). */
@Component({
  selector: 'eras-version-tag',
  template: `v{{ version }}`,
  styles: `
    :host {
      display: block;
      color: var(--color-text-muted);
      font-size: 0.625rem;
      letter-spacing: 0.04em;
      opacity: 0.7;
      font-variant-numeric: tabular-nums;
      user-select: text;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionTagComponent {
  protected readonly version = APP_VERSION;
}
