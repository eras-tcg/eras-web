import { Injectable, signal } from '@angular/core';
import { isDesktopApp } from './app-mode';

/** Where the site publishes the Windows app (the CI's desktop job; the deploy uploads it with the site). */
export const DESKTOP_APP_MANIFEST = 'app/desktop.json';

/** A Windows PC (not a phone: Windows phones are long gone). */
export function isWindows(userAgent: string): boolean {
  return /Windows NT/i.test(userAgent);
}

/**
 * Whether the site offers "Descargar para Windows": on a Windows PC, in the browser or the installed PWA (not inside the
 * Windows app itself), and only when the site publishes an installer.
 */
export function offersDesktopApp(state: { windows: boolean; desktop: boolean; exe: string | null }): boolean {
  return state.windows && !state.desktop && !!state.exe;
}

/** The installer's address in the published manifest (same site), or null. */
export function publishedExe(manifest: unknown, base = 'https://www.erastcg.com/'): string | null {
  const exe = (manifest as { exe?: unknown } | null)?.exe;
  if (typeof exe !== 'string' || !/\.exe(?:[?#]|$)/.test(exe)) return null;
  try {
    // Downloaded from this site (the manifest names the public site; staging serves its own copy)
    return new URL(exe, base).pathname;
  } catch {
    return null;
  }
}

/** "Descargar para Windows": looked up once, on Windows only, when "Descargar ERAS" opens. */
@Injectable({ providedIn: 'root' })
export class DesktopApp {
  readonly windows = typeof navigator !== 'undefined' && isWindows(navigator.userAgent) && !isDesktopApp();
  /** The installer on this site (a path), once known. */
  readonly exe = signal<string | null>(null);
  private looked = false;

  lookUp(): void {
    if (!this.windows || this.looked) return;
    this.looked = true;
    fetch(new URL(DESKTOP_APP_MANIFEST, document.baseURI), { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((manifest: unknown) => this.exe.set(publishedExe(manifest)))
      .catch(() => {
        this.looked = false;
      });
  }
}
