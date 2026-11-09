import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ApiConfig } from '@core/http/api-config';
import { ServerAccess } from '@core/server/server-access';
import { PreferenceValue, applyPreference, onPreferenceChange, storedPreferences } from '@core/storage/preference-registry';
import { firstValueFrom } from 'rxjs';

const PATH = '/api/drive/preferences/me';
/** A change is sent this long after the last one (a slider dragged sends once). */
const SAVE_DELAY_MS = 800;
/** As many as the account keeps (DriveManager's PreferencesService). */
const MAX_KEYS = 64;

interface PreferencesResponse {
  prefs?: Record<string, PreferenceValue> | null;
}

/**
 * The player's preferences (the site's theme, the table's style, the hand's height…) kept with their account, so they
 * follow them to any device. Signed in, the account's are read and applied (the device keeps them too, for playing
 * offline); then each change is saved to the account a moment later. A device's own preferences the account does not
 * have yet (set before signing in, or before this) are sent to it. Without the server (offline, an older server) the
 * device's own still work.
 */
@Injectable({ providedIn: 'root' })
export class PreferenceSync {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly auth = inject(AuthService);
  private readonly access = inject(ServerAccess);

  /** What the account has (as last read or saved): kept whole, so preferences no page has asked for yet are not lost. */
  private remote: Record<string, PreferenceValue> = {};
  /** The account read, for whom (changes are saved only then). */
  private readFor: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      const allowed = this.access.allowed();
      untracked(() => {
        this.readFor = null;
        this.remote = {};
        if (id && allowed) void this.read(id);
      });
    });
    const stop = onPreferenceChange(() => this.schedule());
    inject(DestroyRef).onDestroy(() => {
      stop();
      if (this.timer) clearTimeout(this.timer);
    });
  }

  private async read(id: string): Promise<void> {
    try {
      const me = await firstValueFrom(this.http.get<PreferencesResponse>(this.api.url(PATH)));
      if (this.auth.user()?.id !== id) return;
      this.remote = { ...(me.prefs ?? {}) };
      for (const [key, value] of Object.entries(this.remote)) applyPreference(key, value);
      this.readFor = id;
      // What this device has that the account does not yet: sent
      const local = storedPreferences();
      if (Object.keys(local).some((k) => !(k in this.remote))) this.schedule();
    } catch {
      // Offline or an older server: the device's own preferences
    }
  }

  private schedule(): void {
    if (!this.readFor) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), SAVE_DELAY_MS);
  }

  private async save(): Promise<void> {
    this.timer = null;
    const id = this.readFor;
    if (!id) return;
    const prefs = { ...this.remote, ...storedPreferences() };
    const keys = Object.keys(prefs).slice(0, MAX_KEYS);
    const body = Object.fromEntries(keys.map((k) => [k, prefs[k]]));
    try {
      const saved = await firstValueFrom(this.http.put<PreferencesResponse>(this.api.url(PATH), { prefs: body }));
      if (this.auth.user()?.id === id) this.remote = { ...(saved.prefs ?? body) };
    } catch {
      // Not saved now: the next change sends them all again
    }
  }
}
