import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RANK_DIVISIONS, RANK_LABELS, RankTier } from '@data/ranks/rank.model';
import { RankEmblemComponent } from '@ui/domain/rank-emblem/rank-emblem.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** How each league is played, for the guide (low to high). */
const GUIDE: { tiers: RankTier[]; text: string }[] = [
  { tiers: ['IRON', 'BRONZE'], text: 'Cada victoria te sube una división. Las derrotas no te bajan: aquí solo se avanza.' },
  {
    tiers: ['SILVER', 'GOLD'],
    text: 'Cada victoria te sube una división y cada derrota te baja una. Al llegar a la liga tienes 2 escudos: en la división 1 cada derrota gasta uno antes de bajarte de liga.',
  },
  {
    tiers: ['PLATINUM', 'DIAMOND'],
    text: 'Cada victoria te sube una división y cada derrota te baja una; en la división 1 una derrota te baja de liga. En la última división juegas una serie de ascenso: gana 2 de 3 para subir. Si la pierdes, vuelves a la división 4.',
  },
  {
    tiers: ['CHALLENGER'],
    text: 'Sin divisiones: ganas o pierdes de 10 a 30 puntos por partida según la fuerza de tu rival (más por vencer a uno fuerte). Bajo 0 puntos vuelves a Diamante 4.',
  },
];

/** "Guía de ligas" (the info button of "Clasificación"): how ranked games move the rank, league by league. */
@Component({
  selector: 'eras-league-guide-dialog',
  imports: [ModalComponent, ButtonComponent, RankEmblemComponent],
  template: `
    <eras-modal title="Guía de ligas" (closed)="ref.close()">
      <p class="intro">
        Las partidas ranked (Online o Modo solo) mueven tu rango. Cada liga tiene divisiones: empiezas en Hierro 1 y subes de
        división con cada victoria; al pasar la última, subes de liga.
      </p>
      @for (g of guide; track g.text) {
        <div class="league">
          <span class="emblems">
            @for (t of g.tiers; track t) {
              <eras-rank-emblem [tier]="t" [size]="32" />
            }
          </span>
          <span class="league-text">
            <strong>{{ namesOf(g.tiers) }}</strong>
            <span class="muted">{{ divisionsOf(g.tiers[0]) }}</span>
            <span>{{ g.text }}</span>
          </span>
        </div>
      }
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cerrar</button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .intro { margin: 0 0 var(--space-3); font-size: var(--font-size-sm); }
    .league {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      margin-block-end: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }
    .emblems { display: flex; flex: none; gap: var(--space-1); inline-size: 4.5rem; }
    .league-text { display: flex; flex-direction: column; gap: 2px; }
    .league-text span { font-size: var(--font-size-sm); }
    .muted { color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueGuideDialogComponent {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly guide = GUIDE;
  protected namesOf(tiers: RankTier[]): string {
    return tiers.map((t) => RANK_LABELS[t]).join(' y ');
  }
  protected divisionsOf(tier: RankTier): string {
    return RANK_DIVISIONS[tier] ? `${RANK_DIVISIONS[tier]} divisiones` : 'Por puntos';
  }
}
