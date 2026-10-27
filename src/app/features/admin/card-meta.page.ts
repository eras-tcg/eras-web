import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardMeta } from '@data/cards/card.model';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { CardsStore } from '@data/cards/cards.store';
import { assignImage, metaFormFor, metaWithoutImage } from '@data/cards/meta-rules';
import { TableComponent } from '@ui/data/table/table.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ChoiceDialogComponent, ChoiceDialogData } from '@ui/surfaces/choice-dialog/choice-dialog.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { TabsComponent } from '@ui/surfaces/tabs/tabs.component';
import { MetaFormData, MetaFormDialogComponent } from '../cards/meta-form/meta-form-dialog.component';
import { feedbackState } from './admin-feedback';

type View = 'orphans' | 'all';

/** Card metadata list (manage_cards): find metadata whose image is missing or ambiguous and point it at an image. */
@Component({
  selector: 'eras-card-meta-page',
  imports: [PageComponent, TabsComponent, FormFieldComponent, TableComponent, AlertComponent, EmptyStateComponent, BadgeComponent, ButtonComponent, IconComponent, SpinnerComponent],
  template: `
    <eras-page title="Metadatos de cartas" subtitle="Cada metadato se une a su imagen por edición, número, sub-edición y color" width="wide">
      <button page-actions erasButton variant="secondary" type="button" [disabled]="store.loading()" (click)="store.load(true)">Recargar</button>

      @if (fb.feedback(); as f) {
        <eras-alert [tone]="f.tone">{{ f.text }}</eras-alert>
      }

      <eras-tabs label="Vista" [tabs]="tabs()" [selected]="view()" (selectedChange)="view.set($any($event))" />
      <eras-form-field label="Buscar">
        <input type="search" placeholder="Nombre o edición…" [value]="query()" (input)="query.set($any($event.target).value)" />
      </eras-form-field>

      @if (store.loading() && store.metaList().length === 0) {
        <eras-empty-state title="Cargando…"><eras-spinner /></eras-empty-state>
      } @else if (rows().length === 0) {
        <eras-empty-state [title]="view() === 'orphans' ? 'Todos los metadatos tienen su imagen' : 'Sin resultados'" />
      } @else {
        <eras-table>
          <table>
            <thead>
              <tr><th>Nombre</th><th>Edición</th><th>#</th><th>Color</th><th>Rareza</th><th>Imagen</th><th class="actions">Acciones</th></tr>
            </thead>
            <tbody>
              @for (m of rows(); track m.id) {
                <tr>
                  <td>{{ m.cardName || '—' }}</td>
                  <td>{{ m.edition }}{{ m.subEdition ? '.' + m.subEdition : '' }}</td>
                  <td>{{ m.cardNumber ?? '—' }}</td>
                  <td>{{ m.colorIdentity || '—' }}</td>
                  <td>{{ m.rarity || '—' }}</td>
                  <td>
                    @if (orphanIds().has(m.id)) {
                      <eras-badge tone="danger">Sin imagen</eras-badge>
                    } @else {
                      <eras-badge tone="success">OK</eras-badge>
                    }
                  </td>
                  <td class="actions">
                    <button erasButton variant="ghost" size="sm" type="button" [attr.aria-label]="'Editar ' + m.cardName" (click)="edit(m)"><eras-icon name="edit" /></button>
                    <button erasButton variant="secondary" size="sm" type="button" [disabled]="busy() === m.id" (click)="assign(m)">Asignar imagen</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </eras-table>
      }
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardMetaPage {
  protected readonly store = inject(CardsStore);
  private readonly api = inject(CardsAdminApi);
  private readonly modal = inject(ModalService);

  protected readonly fb = feedbackState();
  protected readonly view = signal<View>('orphans');
  protected readonly query = signal('');
  protected readonly busy = signal<string | null>(null);

  private readonly orphans = computed(() => metaWithoutImage(this.store.metaList(), this.store.imageList()));
  protected readonly orphanIds = computed(() => new Set(this.orphans().map((m) => m.id)));
  protected readonly tabs = computed(() => [
    { key: 'orphans', label: `Sin imagen (${this.orphans().length})` },
    { key: 'all', label: `Todos (${this.store.metaList().length})` },
  ]);
  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.view() === 'orphans' ? this.orphans() : this.store.metaList();
    return [...list]
      .filter((m) => !q || `${m.cardName} ${m.edition}${m.subEdition ? '.' + m.subEdition : ''}`.toLowerCase().includes(q))
      .sort((a, b) => `${a.edition}`.localeCompare(`${b.edition}`) || (a.cardNumber ?? 0) - (b.cardNumber ?? 0));
  });

  constructor() {
    void this.store.load();
  }

  protected async edit(meta: CardMeta): Promise<void> {
    const card = this.store.cards().find((c) => c.meta?.id === meta.id);
    const data: MetaFormData = {
      // Without an image there is no catalog card: edit the metadata as stored
      form: metaFormFor(card ?? { id: '', name: meta.cardName ?? '', edition: meta.edition ?? '', sub_edition: meta.subEdition ?? '', number: meta.cardNumber ?? null, color_identity: meta.colorIdentity ?? null, image_url: null, time_stamp: null, meta }),
      metaId: meta.id,
      imageUrl: card?.image_url ?? null,
      ref: this.store.ref(),
    };
    const saved = await firstValueFrom(this.modal.open<boolean>(MetaFormDialogComponent, { data, width: 'min(64rem, 96vw)' }).closed);
    if (saved) {
      this.fb.ok('Metadatos guardados');
      void this.store.load(true);
    }
  }

  protected async assign(meta: CardMeta): Promise<void> {
    const images = this.store.imageList();
    const data: ChoiceDialogData = {
      title: `Imagen para "${meta.cardName}"`,
      options: [...images]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'))
        .map((d) => ({ value: d.id, label: d.name ?? d.file_name ?? d.id, hint: `${d.edition}${d.sub_edition ? '.' + d.sub_edition : ''} #${d.number} ${d.color_identity ?? ''}` })),
    };
    const id = await firstValueFrom(this.modal.open<string | null>(ChoiceDialogComponent, { data }).closed);
    const image = images.find((d) => d.id === id);
    if (!image) return;
    this.busy.set(meta.id);
    this.fb.clear();
    try {
      const { id: metaId, ...rest } = assignImage(meta, image);
      await firstValueFrom(this.api.updateMeta(metaId, rest));
      this.fb.ok(`"${meta.cardName}" ahora usa la imagen de ${image.name}`);
      void this.store.load(true);
    } catch (e) {
      this.fb.fail(e, 'No se pudo asignar la imagen');
    } finally {
      this.busy.set(null);
    }
  }
}
