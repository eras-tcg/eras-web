import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { PackTier } from '@data/editions/booster-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { dealFromCenter } from './opening/deal-from-center';
import { OpeningCardComponent } from './opening/opening-card.component';
import { BOOM_AT, PackBreakComponent } from './opening/pack-break.component';

/** As in the opening (booster-result.page.ts). */
const BREAK_MS = { pack: 3200, box: 1800 };
const CARDS_AFTER_BOOM_MS = 250;
const PIECES_MS = 1500;
const CARDS = 12;

/**
 * Development only (/dev/pack-break, not in production builds): a pack breaking open and its cards flying out, again
 * and again, with an edition's artwork, to tune the animation without buying anything.
 */
@Component({
  selector: 'eras-pack-break-preview-page',
  imports: [PageComponent, ButtonComponent, IconComponent, ToggleGroupComponent, PackBreakComponent, OpeningCardComponent],
  template: `
    <eras-page title="Prueba · Rotura de sobre" width="wide" fill>
      <ng-container ngProjectAs="[page-actions]">
        <eras-toggle-group label="Sobre" [options]="tiers" [selected]="[tier()]" (toggled)="setTier($any($event))" />
        <eras-toggle-group label="Ritmo" [options]="speeds" [selected]="[speed()]" (toggled)="setSpeed($any($event))" />
        <eras-toggle-group label="Arte" [options]="arts()" [selected]="[artId()]" (toggled)="setArt($event)" />
        <button erasButton type="button" (click)="play()"><eras-icon name="refresh" /> Repetir</button>
      </ng-container>
      <div class="stage">
        @if (breaking() || falling()) {
          <div class="break-layer">
            <eras-pack-break [art]="art()" [duration]="duration()" [tier]="tier()" />
          </div>
        }
        @if (dealt()) {
          <div #cardsBox class="cards" [class.placing]="placing()">
            @for (i of cards; track i) {
              <eras-opening-card />
            }
          </div>
        }
      </div>
    </eras-page>
  `,
  styles: `
    .stage {
      position: relative;
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      min-block-size: 0;
      overflow: clip;
    }
    .break-layer {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: grid;
      place-items: center;
      pointer-events: none;
    }
    .cards {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-3);
      max-inline-size: 60rem;
    }
    .cards.placing eras-opening-card {
      visibility: hidden;
      animation: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackBreakPreviewPage {
  private readonly editions = inject(EditionsStore);
  private readonly auth = inject(AuthService);
  private readonly cardsBox = viewChild<ElementRef<HTMLElement>>('cardsBox');
  private timers: ReturnType<typeof setTimeout>[] = [];

  protected readonly cards = Array.from({ length: CARDS }, (_, i) => i);
  protected readonly speeds: ToggleOption[] = [
    { value: 'pack', label: 'Sobre' },
    { value: 'box', label: 'Caja' },
  ];
  protected readonly speed = signal<'pack' | 'box'>('pack');
  protected readonly tiers: ToggleOption[] = [
    { value: 'none', label: 'Común' },
    { value: 'sr', label: 'SR' },
    { value: 'sec', label: 'SEC' },
    { value: 'god', label: 'GOD' },
  ];
  protected readonly tier = signal<PackTier>('sec');
  protected readonly duration = computed(() => BREAK_MS[this.speed()]);

  private readonly withArt = computed(() => this.editions.editions().filter((e) => e.editionImage).slice(0, 4));
  protected readonly arts = computed<ToggleOption[]>(() => this.withArt().map((e) => ({ value: e.editionId, label: e.editionName ?? e.editionId, text: e.editionId })));
  protected readonly artId = signal('');
  protected readonly art = computed(() => {
    const edition = this.withArt().find((e) => e.editionId === this.artId()) ?? this.withArt()[0];
    // Without a session (no editions to read) the site's logo stands in
    return edition?.editionImage ? `url(${edition.editionImage})` : 'url(logo.png)';
  });

  protected readonly breaking = signal(false);
  protected readonly falling = signal(false);
  protected readonly dealt = signal(false);
  protected readonly placing = signal(false);

  constructor() {
    if (this.auth.user()) void this.editions.load().then(() => this.play());
    else this.play();
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected setTier(value: PackTier): void {
    this.tier.set(value);
    this.play();
  }

  protected setSpeed(value: 'pack' | 'box'): void {
    this.speed.set(value);
    this.play();
  }

  protected setArt(value: string): void {
    this.artId.set(value);
    this.play();
  }

  /** From the start: the break (a new one, so new cracks and shards), then the cards flying out. */
  protected play(): void {
    this.stop();
    this.breaking.set(false);
    this.falling.set(false);
    this.dealt.set(false);
    const cardsAt = this.duration() * BOOM_AT + CARDS_AFTER_BOOM_MS;
    this.later(() => this.breaking.set(true), 30);
    this.later(() => {
      this.breaking.set(false);
      this.falling.set(true);
      this.dealt.set(true);
      this.placing.set(true);
      requestAnimationFrame(() => {
        const box = this.cardsBox()?.nativeElement;
        if (box) dealFromCenter(box, box.parentElement ?? box, this.speed() === 'box' ? 22 : 45);
        this.placing.set(false);
      });
    }, 30 + cardsAt);
    this.later(() => this.falling.set(false), 30 + cardsAt + PIECES_MS);
  }

  private later(run: () => void, ms: number): void {
    this.timers.push(setTimeout(run, ms));
  }

  private stop(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
