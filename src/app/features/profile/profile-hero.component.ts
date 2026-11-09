import { CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarStore } from '@core/auth/avatar.store';
import { BannerStore } from '@core/auth/banner.store';
import { UserImageStore } from '@core/auth/user-image.store';
import { apiErrorMessage } from '@core/http/api-error';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { frameImage } from '@ui/domain/image-framer/frame-image';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { RANK_LABELS, rankTitle } from '@data/ranks/rank.model';
import { RanksStore } from '@data/ranks/ranks.store';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';
import { RankEmblemComponent } from '@ui/domain/rank-emblem/rank-emblem.component';
import { RankProgressComponent } from '@ui/domain/rank-emblem/rank-progress.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';

/**
 * The top of the profile: who the player is as others see them (their icon and name, over their banner) and where
 * they stand in the ranked ladder (league and division, record, highest league, a link to the board). The icon and the
 * banner are changed right here: a small round button on each opens what can be done with it.
 */
@Component({
  selector: 'eras-profile-hero',
  imports: [AvatarComponent, RankEmblemComponent, RankProgressComponent, RouterLink, SpinnerComponent, CdkMenuTrigger, MenuComponent, MenuItemDirective, IconComponent],
  template: `
    <section class="hero" [class.has-banner]="!!banner.url()" [style.--banner]="bannerImage()" aria-label="Tu perfil">
      <input #avatarFile type="file" accept="image/jpeg,image/png,image/gif,image/bmp" hidden (change)="upload(avatar, avatarFile, avatarMax, 'Ícono', 512, 512)" />
      <input #bannerFile type="file" accept="image/jpeg,image/png,image/gif,image/bmp" hidden (change)="upload(banner, bannerFile, bannerMax, 'Portada', 1600, 400)" />

      <!-- The banner's own button, at the box's corner -->
      <button type="button" class="edit banner-edit" aria-label="Portada" title="Portada" [disabled]="banner.saving()" [cdkMenuTriggerFor]="bannerMenu">
        <eras-icon name="image" />
      </button>
      <ng-template #bannerMenu>
        <eras-menu aria-label="Portada">
          <button erasMenuItem (triggered)="bannerFile.click()"><eras-icon name="image" />{{ banner.url() ? 'Cambiar portada' : 'Subir portada' }}</button>
          @if (banner.url()) {
            <button erasMenuItem class="danger" (triggered)="remove(banner, 'Portada')"><eras-icon name="trash" />Quitar portada</button>
          }
        </eras-menu>
      </ng-template>

      <div class="identity">
        <span class="avatar">
          <eras-avatar [url]="avatar.url()" [name]="username()" />
          <!-- The icon's own button, at its lower right -->
          <button type="button" class="edit avatar-edit" aria-label="Ícono" title="Ícono" [disabled]="avatar.saving()" [cdkMenuTriggerFor]="avatarMenu">
            <eras-icon name="edit" />
          </button>
          <ng-template #avatarMenu>
            <eras-menu aria-label="Ícono">
              <button erasMenuItem (triggered)="avatarFile.click()"><eras-icon name="image" />{{ avatar.url() ? 'Cambiar ícono' : 'Subir ícono' }}</button>
              @if (avatar.url()) {
                <button erasMenuItem class="danger" (triggered)="remove(avatar, 'Ícono')"><eras-icon name="trash" />Quitar ícono</button>
              }
            </eras-menu>
          </ng-template>
        </span>
        <span class="who">
          <h2 class="name">{{ username() }}</h2>
          @if (message(); as m) {
            <span class="message" [class.error]="m.error" role="status">{{ m.text }}</span>
          }
        </span>
      </div>

      <div class="rank">
        @if (ranks.mine(); as r) {
          <eras-rank-emblem [tier]="r.tier" [size]="64" />
          <div class="rank-text">
            <span class="tier">{{ title() }}</span>
            <eras-rank-progress [standing]="r" />
            <span class="record">
              <span><strong>{{ r.wins }}</strong> victorias</span>
              <span><strong>{{ r.losses }}</strong> derrotas</span>
              <span>Máximo <strong>{{ peak() }}</strong></span>
            </span>
          </div>
          <a class="board-link" routerLink="/ranking" [queryParams]="{ from: '/profile' }">Ver clasificación</a>
        } @else if (!ranks.loaded()) {
          <span class="muted loading"><eras-spinner size="sm" /> Cargando tu rango…</span>
        } @else if (ranks.failed()) {
          <span class="muted">No se pudo cargar tu rango.</span>
        } @else {
          <span class="muted">Juega partidas ranked (Online o Modo solo) para tener rango.</span>
        }
      </div>
    </section>
  `,
  styles: `
    .hero {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4) var(--space-6);
      padding: var(--space-5) var(--space-6);
      overflow: hidden;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
      background: linear-gradient(110deg, color-mix(in srgb, var(--color-primary) 14%, var(--color-surface)), var(--color-surface) 60%);
    }
    /* Their banner behind, darkened towards the text */
    .hero.has-banner {
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--color-surface) 85%, transparent) 15%, color-mix(in srgb, var(--color-surface) 30%, transparent) 70%),
        var(--banner) center / cover no-repeat;
    }
    /* The small round buttons that change the icon and the banner */
    .edit {
      position: absolute;
      z-index: 2;
      display: inline-grid;
      place-items: center;
      inline-size: 1.9rem;
      block-size: 1.9rem;
      padding: 0;
      border: 2px solid var(--color-surface);
      border-radius: 50%;
      background: var(--color-primary);
      color: var(--color-on-primary);
      box-shadow: var(--shadow-md);
      cursor: pointer;
    }
    .edit eras-icon { inline-size: 0.95rem; block-size: 0.95rem; }
    .edit:hover { filter: brightness(1.1); }
    .edit:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .edit:disabled { opacity: 0.6; cursor: wait; }
    .banner-edit { inset-block-start: var(--space-2); inset-inline-end: var(--space-2); }
    .avatar { position: relative; display: inline-flex; flex: none; }
    .avatar-edit { inset-block-end: -0.15rem; inset-inline-end: -0.15rem; inline-size: 1.7rem; block-size: 1.7rem; }
    .who { display: flex; flex-direction: column; gap: 0.15rem; min-inline-size: 0; }
    .message { color: var(--color-success); font-size: var(--font-size-xs); }
    .message.error { color: var(--color-danger); }
    .identity {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      min-inline-size: 0;

      eras-avatar {
        --avatar-size: 4.5rem;
      }
    }
    .name {
      margin: 0;
      overflow: hidden;
      font-family: var(--font-family-display);
      font-size: var(--font-size-2xl, 1.75rem);
      letter-spacing: 0.04em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rank {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--color-surface) 80%, transparent);
    }
    .rank-text {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .tier {
      font-family: var(--font-family-display);
      font-size: var(--font-size-xl);
      letter-spacing: 0.04em;
    }
    .record {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);

      strong {
        color: var(--color-text);
      }
    }
    .board-link {
      align-self: flex-end;
      color: var(--color-primary);
      font-size: var(--font-size-sm);
      white-space: nowrap;
    }
    .muted {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .loading {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
    @media (max-width: 40rem) {
      .hero {
        padding: var(--space-4);
      }
      .identity eras-avatar {
        --avatar-size: 3.5rem;
      }
      .rank {
        flex-wrap: wrap;
        inline-size: 100%;
      }
      .rank-text {
        flex: 1;
        min-inline-size: 0;
      }
      .board-link {
        flex-basis: 100%;
        align-self: auto;
      }
    }
    /* Phones in landscape: one compact row (name and rank side by side), so the settings start within the screen */
    @media (orientation: landscape) and (max-height: 30rem) {
      .hero {
        flex-wrap: nowrap;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-3);
      }
      .identity {
        gap: var(--space-2);
      }
      .identity eras-avatar {
        --avatar-size: 2.75rem;
      }
      .name {
        font-size: var(--font-size-lg);
      }
      .rank {
        gap: var(--space-2);
        padding: var(--space-1) var(--space-2);
      }
      .rank eras-rank-emblem {
        inline-size: 2.5rem;
        block-size: 2.5rem;
      }
      .tier {
        font-size: var(--font-size-md);
      }
      .record {
        gap: var(--space-2);
        font-size: var(--font-size-xs);
      }
      .board-link {
        font-size: var(--font-size-xs);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileHeroComponent {
  readonly username = input.required<string>();
  protected readonly ranks = inject(RanksStore);
  protected readonly avatar = inject(AvatarStore);
  protected readonly banner = inject(BannerStore);
  private readonly modal = inject(ModalService);
  /** The largest files accepted (the server reshapes and scales them). */
  protected readonly avatarMax = 5 * 1024 * 1024;
  protected readonly bannerMax = 8 * 1024 * 1024;
  /** What the last change did (under the name), or null. */
  protected readonly message = signal<{ text: string; error: boolean } | null>(null);

  protected readonly bannerImage = computed(() => {
    const url = this.banner.url();
    return url ? `url("${url.replace(/"/g, '%22')}")` : null;
  });

  /** Frames the chosen image to `width`×`height` (the shape the server keeps), then uploads it. */
  protected async upload(store: UserImageStore, input: HTMLInputElement, max: number, what: string, width: number, height: number): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > max) {
      this.message.set({ text: `La imagen pesa más de ${Math.round(max / 1024 / 1024)} MB`, error: true });
      return;
    }
    this.message.set(null);
    const framed = await frameImage(this.modal, { title: what, file, width, height, round: width === height });
    if (!framed) return;
    try {
      await store.upload(framed);
      this.message.set({ text: `${what}: guardado`, error: false });
    } catch (e) {
      this.message.set({ text: apiErrorMessage(e, `${what}: no se pudo guardar`), error: true });
    }
  }

  protected async remove(store: UserImageStore, what: string): Promise<void> {
    this.message.set(null);
    try {
      await store.remove();
      this.message.set({ text: `${what}: quitado`, error: false });
    } catch (e) {
      this.message.set({ text: apiErrorMessage(e, `${what}: no se pudo quitar`), error: true });
    }
  }
  protected readonly title = computed(() => {
    const r = this.ranks.mine();
    return r ? rankTitle(r) : '';
  });
  protected readonly peak = computed(() => {
    const r = this.ranks.mine();
    return r ? RANK_LABELS[r.peak] : '';
  });

  constructor() {
    // Fresh when the profile opens (a ranked game may have just ended), unless just read
    void this.ranks.refreshIfStale();
  }
}
