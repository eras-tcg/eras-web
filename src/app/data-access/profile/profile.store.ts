import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ApiConfig } from '@core/http/api-config';
import { firstValueFrom } from 'rxjs';

interface Profile {
  id: string;
  username: string;
  avatar: string | null;
}

/** The signed-in player's profile (UsersService /api/users/me): for now, their icon. */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly auth = inject(AuthService);

  /** "icon:color", or null for the default icon. */
  readonly avatar = signal<string | null>(null);
  readonly saving = signal(false);

  constructor() {
    // Loaded for whoever signs in; cleared on sign-out
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      untracked(() => {
        this.avatar.set(null);
        if (id) void this.load();
      });
    });
  }

  private async load(): Promise<void> {
    try {
      const me = await firstValueFrom(this.http.get<Profile>(this.api.url('/api/users/me')));
      this.avatar.set(me.avatar ?? null);
    } catch {
      // An older server without profiles: the default icon
    }
  }

  async saveAvatar(avatar: string): Promise<void> {
    this.saving.set(true);
    try {
      const me = await firstValueFrom(this.http.put<Profile>(this.api.url('/api/users/me/avatar'), { avatar }));
      this.avatar.set(me.avatar ?? null);
    } finally {
      this.saving.set(false);
    }
  }
}
