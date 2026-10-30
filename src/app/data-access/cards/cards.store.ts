import { Injectable, computed, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { CardMeta, CardRefData, CatalogCard, DriveCard } from './card.model';
import { filterOptions, mergeCards } from './card-rules';
import { CardsApi } from './cards.api';

/** Whole card catalog (images + metadata + reference data), loaded once and shared. */
@Injectable({ providedIn: 'root' })
export class CardsStore {
  private readonly api = inject(CardsApi);

  private readonly images = signal<DriveCard[]>([]);
  private readonly meta = signal<CardMeta[]>([]);
  private loaded = false;

  readonly ref = signal<CardRefData | null>(null);
  /** What the simulator does not run yet, by metadata id (cards fully programmed are not here). */
  readonly unprogrammed = signal<Readonly<Record<string, string>>>({});
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly cards = computed(() => mergeCards(this.images(), this.meta()));
  /** Raw lists, for administration (metadata without image, same-name prefill). */
  readonly metaList = this.meta.asReadonly();
  readonly imageList = this.images.asReadonly();
  readonly options = computed(() => filterOptions(this.cards(), this.meta(), this.ref()));

  /** What of this card the simulator does not run yet, or null (also null without metadata). */
  unprogrammedOf(card: CatalogCard): string | null {
    return (card.meta && this.unprogrammed()[card.meta.id]) || null;
  }

  /** After reference data changes elsewhere (admin), so filters and keyword texts update. */
  setRef(ref: CardRefData): void {
    this.ref.set(ref);
  }

  async load(force = false): Promise<void> {
    if (this.loaded && !force) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [images, meta, ref, unprogrammed] = await Promise.all([
        firstValueFrom(this.api.listImages()),
        firstValueFrom(this.api.listMeta()),
        // Reference data only adds filter options and keyword descriptions; the page works without it
        firstValueFrom(this.api.getRef()).catch(() => null),
        // Only a warning per card: without it the catalog still works
        firstValueFrom(this.api.listUnprogrammed()).catch(() => ({})),
      ]);
      this.images.set(images);
      this.meta.set(meta);
      this.ref.set(ref);
      this.unprogrammed.set(unprogrammed);
      this.loaded = true;
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudieron cargar las cartas'));
    } finally {
      this.loading.set(false);
    }
  }
}
