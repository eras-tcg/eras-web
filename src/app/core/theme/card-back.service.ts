import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject } from '@angular/core';
import { persistedPreference } from '@core/storage/preference-registry';

/** One card back the player can choose. */
export interface CardBack {
  readonly id: string;
  readonly name: string;
  readonly src: string;
}

/** The card backs, the default first (its image is the token's own, styles/tokens/_color.scss). */
export const CARD_BACKS: readonly CardBack[] = [
  { id: 'vortice', name: 'Vórtice', src: '/images/card-back.png' },
  { id: 'clasico', name: 'Clásico', src: '/images/card-backs/clasico.png' },
];

const CARD_BACK_KEY = 'eras-card-back';

/**
 * The back of every face-down card on this screen (the table, piles, flights, pack openings: the --color-card-back
 * token), as the player chose it in Mi perfil → Mesa. Applied as --card-back-image on <html>; remembered on the device
 * and with the account (PreferenceSync).
 */
@Injectable({ providedIn: 'root' })
export class CardBackService {
  private readonly document = inject(DOCUMENT);
  readonly backs = CARD_BACKS;
  readonly id = persistedPreference<string>(CARD_BACK_KEY, CARD_BACKS[0].id, (raw) =>
    typeof raw === 'string' && CARD_BACKS.some((b) => b.id === raw) ? raw : null,
  );
  readonly current = computed(() => CARD_BACKS.find((b) => b.id === this.id()) ?? CARD_BACKS[0]);

  constructor() {
    effect(() => this.document.documentElement.style.setProperty('--card-back-image', `url('${this.current().src}')`));
  }
}
