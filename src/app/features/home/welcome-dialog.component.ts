import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { EditionsStore } from '@data/editions/editions.store';
import { isStructure } from '@data/shop/shop-rules';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/**
 * The greeting of a new player: the four structure decks' artwork, a few words about the world and what the
 * "Bienvenida" gives. Its button closes with 'pick', so the structure deck picker comes next.
 */
@Component({
  selector: 'eras-welcome-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal title="Bienvenida" size="lg" (closed)="ref.close()">
      <div class="hero" aria-hidden="true">
        @for (art of covers(); track art) {
          <span class="art" [style.background-image]="'url(' + art + ')'"></span>
        }
      </div>
      <h2 class="title">¡Bienvenido a ERAS{{ name() ? ', ' + name() : '' }}!</h2>
      <p class="lore">
        Las eras chocan. Entes que cruzan el tiempo, dragones de tierras inexploradas, bestias del inframundo y caballeros
        de la era dorada luchan por el mismo mundo. Hoy empieza tu historia: elige tu bando, arma tu mazo y deja tu marca.
      </p>
      <ul class="gifts">
        <li><eras-icon name="structure" /> <span><strong>Un structure deck gratis</strong> a tu elección</span></li>
        <li><eras-icon name="target" /> <span><strong>Misiones de bienvenida</strong> que te guían y premian paso a paso</span></li>
      </ul>
      <ng-container modal-footer>
        <button erasButton type="button" (click)="ref.close('pick')">
          <eras-icon name="sparkles" /> {{ replay ? 'Continuar' : 'Elegir mi mazo' }}
        </button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .hero {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      block-size: clamp(6rem, 22vw, 10rem);
      margin: calc(-1 * var(--space-2)) 0 var(--space-3);
      overflow: hidden;
      border-radius: var(--radius-md);
      mask-image: linear-gradient(to bottom, #000 55%, transparent);
    }
    .art {
      background-position: center;
      background-size: cover;
      animation: rise 700ms ease both;
    }
    .art:nth-child(2) { animation-delay: 120ms; }
    .art:nth-child(3) { animation-delay: 240ms; }
    .art:nth-child(4) { animation-delay: 360ms; }
    @keyframes rise {
      from { opacity: 0; transform: translateY(0.75rem) scale(1.05); }
    }
    @media (prefers-reduced-motion: reduce) { .art { animation: none; } }
    .title {
      margin: 0 0 var(--space-2);
      font-family: var(--font-family-display);
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-regular);
      letter-spacing: 0.04em;
    }
    .lore { margin: 0 0 var(--space-3); color: var(--color-text-muted); line-height: 1.55; }
    .gifts { display: grid; gap: var(--space-2); margin: 0 0 var(--space-2); padding: 0; list-style: none; }
    .gifts li { display: flex; align-items: center; gap: var(--space-2); }
    .gifts eras-icon { flex-shrink: 0; inline-size: 1.15rem; block-size: 1.15rem; color: var(--color-hub-accent, var(--color-primary)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeDialogComponent {
  protected readonly ref = inject<DialogRef<'pick'>>(DialogRef);
  /** Seen again from "Progreso": the structure decks come next only to look at. */
  protected readonly replay = inject<{ replay?: boolean } | null>(DIALOG_DATA, { optional: true })?.replay ?? false;
  private readonly auth = inject(AuthService);
  private readonly editions = inject(EditionsStore);

  protected readonly name = computed(() => this.auth.user()?.username ?? '');
  /** The structure decks' artwork, in order (ST1…ST4). */
  protected readonly covers = computed(() =>
    this.editions
      .editions()
      .filter((e) => isStructure(e.editionId) && !!e.editionImage)
      .sort((a, b) => a.editionId.localeCompare(b.editionId))
      .map((e) => e.editionImage as string),
  );

  constructor() {
    void this.editions.load();
  }
}
