import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SheetComponent } from '@ui/surfaces/sheet/sheet.component';

export interface CreatureInteractionData {
  /** Card dropped onto the creature. */
  summoned: CardSlot;
  /** Creature already on the field. */
  summoner: CardSlot;
  fromZone: ZoneName;
}

const SUMMON_KINDS = ['materialization', 'evolution', 'ritual', 'promotion'];

/** Dropping a card onto a creature: special summon (if the card has one), attach as material or as resource. */
@Component({
  selector: 'eras-creature-interaction-dialog',
  imports: [SheetComponent, GameCardComponent, StackComponent, ButtonComponent],
  template: `
    <eras-sheet title="Interacción de criaturas" (closed)="ref.close()">
      <eras-stack direction="row" [gap]="4" justify="center" align="center">
        <eras-stack [gap]="1" align="center"><eras-game-card [imageUrl]="data.summoned.imageUrl" [name]="data.summoned.cardName ?? null" /><span>Entrante</span></eras-stack>
        <span aria-hidden="true">→</span>
        <eras-stack [gap]="1" align="center"><eras-game-card [imageUrl]="data.summoner.imageUrl" [name]="data.summoner.cardName ?? null" /><span>En campo</span></eras-stack>
      </eras-stack>

      @if (askAttachments()) {
        <eras-stack [gap]="2">
          <strong>¿Qué hacer con los anexos de la carta entrante?</strong>
          <button erasButton variant="secondary" type="button" (click)="material('resources_only')">Solo recursos: al campo; descartar materiales</button>
          <button erasButton variant="secondary" type="button" (click)="material('materials_only')">Solo materiales: al campo; descartar recursos</button>
          <button erasButton variant="secondary" type="button" (click)="material('all')">Transferir todo</button>
          <button erasButton variant="danger" type="button" (click)="material('discard_all')">Descartar todo</button>
        </eras-stack>
      } @else {
        <eras-stack [gap]="2">
          @if (summonKind(); as kind) {
            <button erasButton type="button" (click)="specialSummon(kind)">Invocación especial: {{ summonLabels[kind] }}</button>
          }
          <button erasButton variant="secondary" type="button" (click)="tryMaterial()">Agregar como material</button>
          <button erasButton variant="secondary" type="button" (click)="resource()">Agregar como recurso</button>
        </eras-stack>
      }
      <ng-container sheet-footer>
        <button erasButton variant="ghost" type="button" (click)="ref.close()">Cancelar</button>
      </ng-container>
    </eras-sheet>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatureInteractionDialogComponent {
  protected readonly data = inject<CreatureInteractionData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  private readonly game = inject(GameStore);

  protected readonly summonLabels = SPECIAL_SUMMON_LABELS;
  protected readonly askAttachments = signal(false);
  protected readonly summonKind = computed(() => {
    const kind = this.data.summoned.specialSummonKind?.toLowerCase().trim() ?? '';
    return SUMMON_KINDS.includes(kind) ? kind : null;
  });

  protected specialSummon(kind: string): void {
    this.game.specialSummon(this.data.summoned.instanceId, this.data.fromZone, this.data.summoner.instanceId, kind);
    this.ref.close();
  }

  protected tryMaterial(): void {
    const s = this.data.summoned;
    // A creature moved from the field brings its own attachments: ask what to do with them
    if (this.data.fromZone === 'field' && s.materials.length + s.resources.length > 0) this.askAttachments.set(true);
    else this.material(null);
  }

  protected material(choice: string | null): void {
    this.game.addMaterial(this.data.summoned.instanceId, this.data.fromZone, this.data.summoner.instanceId, choice);
    this.ref.close();
  }

  protected resource(): void {
    this.game.addResource(this.data.summoned.instanceId, this.data.fromZone, this.data.summoner.instanceId);
    this.ref.close();
  }
}
