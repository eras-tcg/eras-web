import { DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { AppOffline, AppReadiness } from '@core/pwa/app-offline';
import { StorageUsage, costlyConnection, formatBytes, persistStorage, storageUsage } from '@core/pwa/device-storage';
import { OnlineStatus } from '@core/server/online-status';
import { CardsStore } from '@data/cards/cards.store';
import { DecksStore } from '@data/decks/decks.store';
import { PictureProgress, canKeepPictures, estimateBytes, keepPictures, missingPictures } from '@data/simulator/card-images';
import { offlinePictures } from '@data/simulator/local-decks';
import { OfflineGame } from '@data/simulator/offline-game';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** How often the app's own download (the service worker's) is looked at while it is not complete. */
const READINESS_EVERY_MS = 2000;

/** Why a big download deserves a second thought, from what the browser says of the connection. */
export function connectionWarning(connection: ReturnType<typeof costlyConnection>): string | null {
  if (!connection) return null;
  if (connection.saveData) return 'Tienes activado el ahorro de datos.';
  if (connection.metered) return 'Estás usando datos móviles.';
  if (connection.slow) return 'Tu conexión es lenta.';
  return null;
}

/**
 * "Descargar para jugar sin conexión": what the installed app needs to open and play against the bot without the
 * connection. The app itself (code, engine, starter decks) is the service worker's (it shows how far it got); the card
 * pictures of the starter decks and of the player's saved decks are downloaded here on request, with the progress, an
 * estimate of the size, a way to cancel, and the device's storage. Asks the browser to keep the storage (persist).
 */
@Component({
  selector: 'eras-offline-download-dialog',
  imports: [DatePipe, ModalComponent, AlertComponent, ButtonComponent, IconComponent, SpinnerComponent],
  template: `
    <eras-modal title="Jugar sin conexión" subtitle="Lo que ERAS guarda en este dispositivo para jugar contra el bot sin internet." (closed)="close()">
      <section class="row" aria-labelledby="offline-app">
        <eras-icon [name]="app()?.ready ? 'check-circle' : 'box'" />
        <div>
          <h3 id="offline-app">La aplicación</h3>
          @if (app(); as state) {
            @if (!state.supported) {
              <p class="muted">Este navegador no puede guardar la aplicación: necesita conexión al abrirla.</p>
            } @else if (state.ready) {
              <p>Lista: se abre sin conexión.</p>
            } @else {
              <p class="muted">Descargando… {{ state.cached }} de {{ state.total }} archivos.</p>
            }
          } @else {
            <p class="muted">Comprobando…</p>
          }
        </div>
      </section>

      <section class="row" aria-labelledby="offline-decks">
        <eras-icon name="stack" />
        <div>
          <h3 id="offline-decks">Mazos</h3>
          @if (decks(); as d) {
            <p>
              Los mazos iniciales
              @if (d.mine) {
                y {{ d.mine === 1 ? 'tu mazo guardado' : 'tus ' + d.mine + ' mazos guardados' }}
              }
              @if (d.savedAt) {
                <span class="muted">(guardados el {{ d.savedAt | date: 'd/M/yyyy, HH:mm' }})</span>
              }
            </p>
          } @else {
            <p class="muted">Comprobando…</p>
          }
        </div>
      </section>

      <section class="row" aria-labelledby="offline-pictures">
        <eras-icon name="image" />
        <div class="grow">
          <h3 id="offline-pictures">Imágenes de las cartas</h3>
          @if (!canKeep) {
            <p class="muted">Este navegador no permite guardarlas: sin conexión las cartas muestran su nombre.</p>
          } @else if (pictures() === null) {
            <p class="muted">Comprobando…</p>
          } @else {
            <p>
              {{ kept() }} de {{ pictures()!.length }} guardadas.
              @if (missing().length && !running()) {
                Faltan {{ missing().length }} (≈ {{ size(estimate()) }}).
              }
            </p>
            @if (progress(); as p) {
              <progress [value]="p.done" [max]="p.total" [attr.aria-label]="'Descargadas ' + p.done + ' de ' + p.total"></progress>
              <p class="muted">
                {{ p.done }} de {{ p.total }}
                @if (p.measured) {
                  · {{ size(p.bytes) }}
                }
                @if (p.failed) {
                  · {{ p.failed }} no se pudieron descargar
                }
              </p>
            }
          }
        </div>
      </section>

      @if (warning(); as why) {
        <eras-alert tone="info">{{ why }} La descarga pesa unos {{ size(estimate()) }}; puedes hacerla más tarde con wifi.</eras-alert>
      }
      @if (!network.online()) {
        <eras-alert tone="info">Sin conexión: la descarga se puede hacer cuando vuelva internet.</eras-alert>
      }
      @if (error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      @if (finished()) {
        <eras-alert tone="success">Listo: las imágenes quedaron guardadas para jugar sin conexión.</eras-alert>
      }

      <p class="storage muted">
        @if (storage(); as s) {
          Espacio usado por ERAS en este dispositivo: {{ size(s.usage) }} de {{ size(s.quota) }} disponibles.
        }
        @if (persisted()) {
          El navegador no lo borrará aunque falte espacio.
        }
      </p>

      <ng-container modal-footer>
        @if (running()) {
          <button erasButton variant="secondary" type="button" data-while-busy (click)="cancel()">Cancelar</button>
          <eras-spinner label="Descargando" />
        } @else {
          <button erasButton variant="ghost" type="button" (click)="close()">Cerrar</button>
          <button erasButton type="button" [disabled]="!canDownload()" (click)="download()">
            <eras-icon name="download" /> {{ warning() && missing().length ? 'Descargar de todos modos' : 'Descargar' }}
          </button>
        }
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .row { display: flex; gap: var(--space-3); align-items: flex-start; }
    .row > eras-icon { flex: none; inline-size: 1.4rem; block-size: 1.4rem; margin-block-start: 0.15rem; color: var(--color-primary); }
    .grow { flex: 1; min-inline-size: 0; }
    h3 { margin: 0 0 var(--space-1); font-size: var(--font-size-md, 1rem); }
    p { margin: 0; }
    .muted { color: var(--color-text-muted); }
    .storage { font-size: var(--font-size-xs); }
    progress { inline-size: 100%; block-size: 0.5rem; margin-block: var(--space-2) var(--space-1); accent-color: var(--color-primary); }
    eras-icon { inline-size: 1rem; block-size: 1rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflineDownloadDialogComponent {
  private readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly appOffline = inject(AppOffline);
  private readonly offline = inject(OfflineGame);
  private readonly auth = inject(AuthService);
  private readonly cards = inject(CardsStore);
  private readonly decksStore = inject(DecksStore);
  protected readonly network = inject(OnlineStatus);
  protected readonly canKeep = canKeepPictures();

  protected readonly app = signal<AppReadiness | null>(null);
  protected readonly decks = signal<{ mine: number; savedAt: number | null } | null>(null);
  /** Every picture an offline game can show now (starter decks and saved decks), and those not kept yet. */
  protected readonly pictures = signal<string[] | null>(null);
  protected readonly missing = signal<string[]>([]);
  protected readonly kept = computed(() => (this.pictures()?.length ?? 0) - this.missing().length);
  protected readonly progress = signal<PictureProgress | null>(null);
  protected readonly running = signal(false);
  protected readonly finished = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly storage = signal<StorageUsage | null>(null);
  protected readonly persisted = signal(false);
  protected readonly warning = signal(connectionWarning(costlyConnection()));
  protected readonly estimate = computed(() => estimateBytes(this.missing().length, this.progress()));
  protected readonly canDownload = computed(() => this.network.online() && this.canKeep && this.missing().length > 0);
  protected readonly size = formatBytes;

  private abort: AbortController | null = null;
  private readinessTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.abort?.abort();
      clearTimeout(this.readinessTimer);
    });
    void this.checkApp();
    void this.refresh();
    void this.refreshStorage();
  }

  protected close(): void {
    this.ref.close();
  }

  protected cancel(): void {
    this.abort?.abort();
  }

  protected async download(): Promise<void> {
    if (this.running()) return;
    this.running.set(true);
    this.finished.set(false);
    this.error.set(null);
    const abort = (this.abort = new AbortController());
    // The player wants the game on this device: the browser is asked to keep it, and the app is downloaded now
    void persistStorage().then((p) => this.persisted.set(p));
    void this.appOffline.ensureRegistered().then(() => this.checkApp());
    const urls = this.missing();
    this.progress.set({ done: 0, total: urls.length, failed: 0, bytes: 0, measured: 0 });
    try {
      const result = await keepPictures(urls, { signal: abort.signal, progress: (p) => this.progress.set(p) });
      this.finished.set(result.failed === 0);
      if (result.failed) this.error.set(`${result.failed} imágenes no se pudieron descargar. Puedes intentarlo de nuevo.`);
    } catch (e) {
      if (!abort.signal.aborted) this.error.set(e instanceof Error ? e.message : 'No se pudieron descargar las imágenes');
    } finally {
      this.running.set(false);
      this.abort = null;
      await this.refresh(false);
      void this.refreshStorage();
    }
  }

  /** The decks and their pictures; with the connection the catalog and the player's decks are loaded first. */
  private async refresh(load = true): Promise<void> {
    try {
      const userId = this.auth.user()?.id;
      if (load && this.network.online()) await Promise.all([this.cards.load(), userId ? this.decksStore.loadMine(userId) : null]);
      const sources = await this.offline.sources();
      this.decks.set({ mine: sources.mine.filter((d) => d.cards.length).length, savedAt: sources.savedAt });
      const urls = offlinePictures(await this.offline.decksNow());
      this.pictures.set(urls);
      this.missing.set(await missingPictures(urls));
    } catch {
      this.pictures.set([]);
      this.missing.set([]);
    }
  }

  private async refreshStorage(): Promise<void> {
    this.storage.set(await storageUsage());
    try {
      this.persisted.set((await navigator.storage?.persisted?.()) ?? false);
    } catch {
      this.persisted.set(false);
    }
  }

  private async checkApp(): Promise<void> {
    clearTimeout(this.readinessTimer);
    const state = await this.appOffline.readiness();
    this.app.set(state);
    if (state.supported && !state.ready) this.readinessTimer = setTimeout(() => void this.checkApp(), READINESS_EVERY_MS);
  }
}
