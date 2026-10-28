import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Centered frame for the account pages (login, register, validate): brand, heading and one card.
 * <eras-auth-layout heading="Iniciar sesión"> ...form... <a auth-footer>…</a></eras-auth-layout>
 */
@Component({
  selector: 'eras-auth-layout',
  template: `
    <div class="frame">
      <img class="logo" src="favicon.svg" alt="" />
      <div class="brand" aria-hidden="true">ERAS</div>
      <p class="tagline">Juego de cartas coleccionables</p>
      <section class="panel" [attr.aria-labelledby]="'auth-heading'">
        <h1 id="auth-heading" class="heading">{{ heading() }}</h1>
        @if (subtitle()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
        <ng-content />
      </section>
      <div class="footer"><ng-content select="[auth-footer]" /></div>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-block-size: calc(100vh - 4rem);
      padding: var(--space-6) var(--layout-gutter);
      background:
        radial-gradient(60rem 30rem at 50% -10%, color-mix(in srgb, var(--color-text) 7%, transparent), transparent 70%),
        var(--color-bg);
    }
    .frame {
      display: flex;
      flex-direction: column;
      align-items: center;
      inline-size: min(100%, 26rem);
      gap: var(--space-2);
    }
    .logo {
      inline-size: 4.5rem;
      block-size: 4.5rem;
      margin-block-end: var(--space-2);
      filter: drop-shadow(0 6px 18px rgb(42 82 116 / 35%));
    }
    .brand {
      font-family: var(--font-family-display);
      font-size: clamp(2.5rem, 8vw, 3.5rem);
      letter-spacing: 0.08em;
      line-height: 1;
    }
    .tagline {
      margin: 0 0 var(--space-4);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .panel {
      inline-size: 100%;
      padding: var(--space-6);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
    }
    .heading {
      margin: 0 0 var(--space-1);
      font-size: var(--font-size-lg);
    }
    .subtitle {
      margin: 0 0 var(--space-4);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .heading:last-of-type:not(:has(+ .subtitle)) {
      margin-block-end: var(--space-4);
    }
    .footer {
      margin-block-start: var(--space-3);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      text-align: center;
    }
    .footer:empty {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
