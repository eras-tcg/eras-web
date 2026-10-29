import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardSlot } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { IconButtonComponent } from '@ui/primitives/icon-button/icon-button.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { SheetComponent } from '@ui/surfaces/sheet/sheet.component';
import { CardInfoData, CardInfoDialogComponent } from './card-info-dialog.component';

export interface AttackTargetData {
  attacker: CardSlot;
  opponentName: string;
  /** Enemy creatures that can be attacked: exhausted ones, or active ones it can face (Enfrentar). */
  creatures: readonly CardSlot[];
}

/** The rival, or one of their creatures it can attack. Closes with the creature id, null for the rival, undefined if cancelled. */
@Component({
  selector: 'eras-attack-target-dialog',
  imports: [SheetComponent, GameCardComponent, IconComponent, IconButtonComponent],
  template: `
    <eras-sheet size="lg" [title]="'Atacar con ' + (data.attacker.cardName ?? 'tu criatura')" subtitle="Se agota al declarar el ataque. Elige el objetivo." (closed)="ref.close()">
      <div class="targets" role="group" aria-label="Objetivos del ataque">
        <button type="button" class="target rival" (click)="ref.close(null)">
          <eras-icon name="user" />
          <span>{{ data.opponentName }}</span>
          <small>Daño directo a sus vidas</small>
        </button>
        @for (c of data.creatures; track c.instanceId) {
          <!-- As it is on the board: exhausted, or active (Enfrentar) -->
          <div class="slot">
            <button type="button" class="target" [attr.aria-label]="'Atacar a ' + (c.cardName ?? 'la criatura')" (click)="ref.close(c.instanceId)">
              <eras-game-card [imageUrl]="c.imageUrl" [tapped]="!!c.tapped" />
              <small>{{ c.tapped ? 'Agotada' : 'Activa' }}</small>
            </button>
            <button type="button" erasIconButton icon="eye" size="sm" class="peek-btn" [attr.aria-label]="'Ver ' + (c.cardName ?? 'la carta')" (click)="detail(c)"></button>
          </div>
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
    .slot { position: relative; display: flex; }
    .peek-btn { position: absolute; inset-block-start: 0.4rem; inset-inline-end: 0.4rem; z-index: 2; opacity: 0.85; }
    .peek-btn:hover, .peek-btn:focus-visible { opacity: 1; }
    small { color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttackTargetDialogComponent {
  protected readonly data = inject<AttackTargetData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string | null>>(DialogRef);
  private readonly modal = inject(ModalService);

  /** The creature in detail as on the board, with its Materiales and Recursos. */
  protected detail(c: CardSlot): void {
    const data: CardInfoData = { instanceId: c.instanceId, zone: 'field', opponent: true, readonly: true };
    this.modal.open(CardInfoDialogComponent, { data });
  }
}
