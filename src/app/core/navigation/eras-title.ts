import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy } from '@angular/router';

/** The window's and tab's name. */
export const APP_TITLE = 'ERAS';

/**
 * The tab (and the installed app's window) is always named ERAS, whatever screen is open: the routes' own titles name
 * the screen for the router only, never the tab.
 */
@Injectable({ providedIn: 'root' })
export class ErasTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(): void {
    if (this.title.getTitle() !== APP_TITLE) this.title.setTitle(APP_TITLE);
  }
}
