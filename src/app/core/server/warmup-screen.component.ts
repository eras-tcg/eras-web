import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ServerWarmupService } from './server-warmup.service';

/** Shown while a backend that sleeps starts up (environment.wakeUrl): the site cannot load anything until then. */
@Component({
  selector: 'eras-warmup-screen',
  imports: [SpinnerComponent, ButtonComponent],
  template: `
    <main class="warmup" aria-live="polite">
      <img class="logo" src="favicon.svg" alt="" />
      <h1>ERAS</h1>
      @switch (warmup.state()) {
        @case ('failed') {
          <p class="title">El servidor no respondió</p>
          <p class="muted">Se intentó encender durante unos minutos sin éxito. Prueba de nuevo en un momento.</p>
          <button erasButton type="button" (click)="warmup.retry()">Reintentar</button>
        }
        @case ('waking') {
          <eras-spinner size="lg" label="Encendiendo el servidor" />
          <p class="title">Encendiendo el servidor…</p>
          <p class="muted">
            Se apaga cuando nadie lo usa durante un rato, y tarda alrededor de un minuto en volver.
            @if (warmup.waited() > 0) {
              <br />Llevamos {{ warmup.waited() }} s.
            }
          </p>
        }
        @default {
          <eras-spinner size="lg" label="Conectando" />
          <p class="title">Conectando…</p>
        }
      }
    </main>
  `,
  styles: `
    .warmup {
      display: grid;
      place-content: center;
      justify-items: center;
      gap: var(--space-3, 0.75rem);
      min-block-size: 100dvh;
      padding: var(--space-4, 1rem);
      background: var(--color-bg);
      color: var(--color-text);
      text-align: center;
    }
    .logo { inline-size: 4rem; block-size: 4rem; }
    h1 { margin: 0; letter-spacing: 0.2em; }
    .title { margin: 0; font-weight: 600; }
    .muted { margin: 0; max-inline-size: 28rem; color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarmupScreenComponent {
  protected readonly warmup = inject(ServerWarmupService);
}
