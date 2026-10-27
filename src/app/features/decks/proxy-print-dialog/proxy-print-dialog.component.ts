import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@core/http/api-error';
import { MIN_PRINT_MARGIN, PAPER_SIZES, cardsPerPage } from '@data/decks/deck-rules';
import { Orientation, PaperSize } from '@data/decks/deck.model';
import { DecksApi } from '@data/decks/decks.api';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

export interface ProxyPrintDialogData {
  deckName: string;
  /** One id per copy. */
  cardIds: string[];
}

/** Print settings for a PDF of the deck at real card size (the server builds the PDF). */
@Component({
  selector: 'eras-proxy-print-dialog',
  imports: [ModalComponent, StackComponent, FormFieldComponent, AlertComponent, ButtonComponent, ChipComponent],
  templateUrl: './proxy-print-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProxyPrintDialogComponent {
  protected readonly data = inject<ProxyPrintDialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  private readonly api = inject(DecksApi);

  protected readonly papers = PAPER_SIZES;
  protected readonly minMargin = MIN_PRINT_MARGIN;
  protected readonly paper = signal<PaperSize>('letter');
  protected readonly orientation = signal<Orientation>('landscape');
  protected readonly margin = signal(0.5);
  protected readonly brightness = signal(20);
  protected readonly contrast = signal(20);
  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly perPage = computed(() => cardsPerPage(this.paper(), this.orientation(), this.margin()));
  protected readonly pages = computed(() => (this.perPage() ? Math.ceil(this.data.cardIds.length / this.perPage()) : 0));

  protected number(event: Event): number {
    return (event.target as HTMLInputElement).valueAsNumber;
  }

  protected async download(): Promise<void> {
    this.generating.set(true);
    this.error.set(null);
    try {
      const pdf = await firstValueFrom(
        this.api.proxyPdf({
          cardIds: this.data.cardIds,
          paperSize: this.paper(),
          orientation: this.orientation(),
          margin: this.margin(),
          brightness: this.brightness(),
          contrast: this.contrast(),
        }),
      );
      const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `proxies-${this.data.deckName || 'mazo'}.pdf`;
      link.click();
      // Revoking right away can cancel the download in some browsers
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo generar el PDF'));
    } finally {
      this.generating.set(false);
    }
  }
}
