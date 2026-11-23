import { InjectionToken, Type } from '@angular/core';

/**
 * Loads the news log dialog (a feature, which core cannot import): the bar's bell opens it, every news item of the
 * platform by date. Provided in app.config.
 */
export const NEWS_LOG_DIALOG = new InjectionToken<() => Promise<Type<unknown>>>('NEWS_LOG_DIALOG');
