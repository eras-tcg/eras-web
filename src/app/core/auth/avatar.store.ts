import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

interface AvatarResponse {
  url: string | null;
}

/**
 * The signed-in user's icon: an image they upload (DriveManager scales it to a square and keeps it in R2). Shown in
 * the navbar, the profile and beside their name in the simulator.
 */
@Injectable({ providedIn: 'root' })
export class AvatarStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly auth = inject(AuthService);

  /** The icon's URL, or null for none (the initial is shown). */
  readonly url = signal<string | null>(null);
  readonly saving = signal(false);

  constructor() {
    // Loaded for whoever signs in; cleared on sign-out
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      untracked(() => {
        this.url.set(null);
        if (id) void this.load();
      });
    });
  }

  private async load(): Promise<void> {
    try {
      const me = await firstValueFrom(this.http.get<AvatarResponse>(this.api.url('/api/drive/avatars/me')));
      this.url.set(me.url ?? null);
    } catch {
      // An older server without icons: the initial
    }
  }

  /** Uploads the image as it is; the server crops and scales it. */
  async upload(file: File): Promise<void> {
    this.saving.set(true);
    try {
      const me = await firstValueFrom(
        this.http.put<AvatarResponse>(this.api.url('/api/drive/avatars/me'), file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        }),
      );
      this.url.set(me.url ?? null);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.http.delete(this.api.url('/api/drive/avatars/me'), { responseType: 'text' }));
      this.url.set(null);
    } finally {
      this.saving.set(false);
    }
  }
}
