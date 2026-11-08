import { HttpClient } from '@angular/common/http';
import { effect, inject, signal, untracked } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ServerAccess } from '../server/server-access';

interface ImageResponse {
  url: string | null;
}

/**
 * An image the signed-in user uploads for themselves at `path` (their icon, their playmat): DriveManager reshapes it
 * and keeps it in R2. Loaded for whoever signs in, cleared on sign-out.
 */
export abstract class UserImageStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly auth = inject(AuthService);
  /** The installed app asks the server nothing before connecting (ServerAccess). */
  private readonly access = inject(ServerAccess);

  /** The image's URL, or null for none. */
  readonly url = signal<string | null>(null);
  readonly saving = signal(false);
  /** Read for this account (before that, no image means not known yet). */
  readonly loaded = signal(false);

  protected constructor(private readonly path: string) {
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      const allowed = this.access.allowed();
      untracked(() => {
        this.url.set(null);
        this.loaded.set(false);
        if (id && allowed) void this.load();
      });
    });
  }

  private async load(): Promise<void> {
    try {
      const me = await firstValueFrom(this.http.get<ImageResponse>(this.api.url(this.path)));
      this.url.set(me.url ?? null);
    } catch {
      // An older server without it: none
    } finally {
      this.loaded.set(true);
    }
  }

  /** Uploads the image as it is; the server reshapes and scales it. */
  async upload(file: File): Promise<void> {
    this.saving.set(true);
    try {
      const me = await firstValueFrom(
        this.http.put<ImageResponse>(this.api.url(this.path), file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } }),
      );
      this.url.set(me.url ?? null);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.http.delete(this.api.url(this.path), { responseType: 'text' }));
      this.url.set(null);
    } finally {
      this.saving.set(false);
    }
  }
}
