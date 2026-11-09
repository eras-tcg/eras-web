import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject } from '@angular/core';
import { persistedPreference } from '@core/storage/preference-registry';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'theme';

/**
 * Applies the theme as `data-theme` on <html>; the values live in styles/themes. Remembered on the device and with
 * the account (PreferenceSync); never chosen, the system's.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly theme = persistedPreference<Theme>(THEME_KEY, this.systemTheme(), (raw) => (raw === 'light' || raw === 'dark' ? raw : null));

  constructor() {
    effect(() => this.document.documentElement.setAttribute('data-theme', this.theme()));
  }

  toggle(): void {
    this.theme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }

  private systemTheme(): Theme {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
