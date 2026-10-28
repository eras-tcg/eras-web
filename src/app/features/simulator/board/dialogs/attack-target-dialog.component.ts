import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardSlot } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SheetComponent } from '@ui/surfaces/sheet/sheet.component';

export interface AttackTargetData {
  attacker: CardSlot;
  opponentName: string;
  /** Enemy creatures that can be attacked: exhausted ones, or active ones it can face (Enfrentar). */
  creatures: readonly CardSlot[];
}

/** The rival, or one of their exhausted creatures. Closes with the creature id, null for the rival, undefined if cancelled. */
@Component({
  selector: 'eras-attack-target-dialog',
  imports: [SheetComponent, GameCardComponent, IconComponent],
  template: `
    <eras-sheet size="lg" [title]="'Atacar con ' + (data.attacker.cardName ?? 'tu criatura')" subtitle="Se agota al declarar el ataque. Elige el objetivo." (closed)="ref.close()">
      <div class="targets" role="group" aria-label="Objetivos del ataque">
        <button type="button" class="target rival" (click)="ref.close(null)">
          <eras-icon name="user" />
          <span>{{ data.opponentName }}</span>
          <small>Daño directo a sus vidas</small>
        </button>
        @for (c of data.creatures; track c.instanceId) {
          <button type="button" class="target" [attr.aria-label]="'Atacar a ' + (c.cardName ?? 'criatura agotada')" (click)="ref.close(c.instanceId)">
            <eras-game-card [imageUrl]="c.imageUrl" [tapped]="true" />
            <span>{{ c.cardName }}</span>
          </button>
        }
      </div>
    </eras-sheet>
  `,
  styles: `
    .targets { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3); }
    .target {
      --game-card-width: 6.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      min-inline-size: 8rem;
      padding: var(--space-2);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: inherit;
      font-size: var(--font-size-sm);
      cursor: pointer;
    }
    .target:hover { border-color: var(--color-danger); }
    .target:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .rival eras-icon { inline-size: 2.5rem; block-size: 2.5rem; }
    small { color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttackTargetDialogComponent {
  protected readonly data = inject<AttackTargetData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string | null>>(DialogRef);
}
