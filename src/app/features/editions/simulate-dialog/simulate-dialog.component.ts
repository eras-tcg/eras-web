import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Edition, RARITIES } from '@data/editions/edition.model';
import { canSimulateBox, pickRandomPackFromBox } from '@data/editions/edition-rules';
import { RarityBadgeComponent } from '@ui/domain/rarity-badge/rarity-badge.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** Lets the user pick how to simulate an opening, then goes to the booster result page. */
@Component({
  selector: 'eras-simulate-dialog',
  imports: [ModalComponent, StackComponent, ButtonComponent, ChipComponent, IconComponent, RarityBadgeComponent],
  templateUrl: './simulate-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulateDialogComponent {
  protected readonly edition = inject<Edition>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  private readonly router = inject(Router);

  protected readonly rarities = RARITIES;
  protected readonly packTypes = this.edition.packTypes ?? [];
  protected readonly selectedIndex = signal(0);
  protected readonly selected = computed(() => this.packTypes[this.selectedIndex()] ?? null);
  protected readonly hasBox = canSimulateBox(this.edition);
  protected readonly totalPacks = this.edition.boxConfig?.totalPacks ?? 0;

  protected openPack(): void {
    const pack = this.selected();
    if (pack) this.go({ mode: 'pack', packType: pack.name });
  }

  protected openRandomPack(): void {
    this.go({ mode: 'pack', packType: pickRandomPackFromBox(this.edition), random: '1' });
  }

  protected openBox(): void {
    this.go({ mode: 'box' });
  }

  private go(params: Record<string, string>): void {
    this.ref.close();
    void this.router.navigate(['/booster-result'], { queryParams: { edition: this.edition.editionId, ...params } });
  }
}
