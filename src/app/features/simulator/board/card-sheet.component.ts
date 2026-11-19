import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, booleanAttribute, computed, inject, input } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { displayStrength } from '@data/simulator/game-rules';
import { formationGrants } from '@data/simulator/formations';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { CardFactsComponent } from '@ui/domain/card-facts/card-facts.component';
import { EffectLineComponent } from '@ui/domain/effect-line/effect-line.component';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { openCardDetailDialog } from '../../cards/card-detail-dialog/card-detail-dialog.component';
import { EffectLine, effectLines, matchingLine } from './card-effect-lines';
import { HoldPeekDirective } from './hold-peek';
import { slotFacts } from './slot-facts';

/** An effect shown in a section, with where it comes from (a Recurso, a linked creature) and whether it is the one that asks. */
interface SheetLine {
  line: EffectLine;
  source: string | null;
  active: boolean;
}

/**
 * A card of the game as it is now: the card with its Materiales peeking out behind it and its Recursos under it (as on the
 * table), then its numbers, what modifies it, its own effects, its link effect, the effects its Recursos give it, what it
 * receives by link and its Materiales. `activeText`: the effect that asks, lit up wherever it is (its own or a Recurso's).
 * Side by side in a dialog; `column` stacks it (a side panel). Held pressed, a card of it opens in detail.
 */
@Component({
  selector: 'eras-card-sheet',
  imports: [NgTemplateOutlet, IconComponent, EffectLineComponent, CardFactsComponent, GameCardComponent, HoldPeekDirective],
  host: { '[class.column]': 'column()' },
  template: `
    @let s = slot();
    <div class="showcase" [style.--materials]="s.materials.length">
      <!-- The card with its Materiales peeking out behind it, and its Recursos under it, as on the table -->
      <div class="art">
        @for (m of s.materials; track m.instanceId; let i = $index) {
          <div class="material" [style.--i]="i" [erasHoldPeek]="!m.faceDown || game.seeAll()" (peek)="openDetail(m)">
            <eras-game-card [imageUrl]="m.imageUrl" [foil]="m.finish ?? null" [name]="m.cardName ?? null" [hidden]="m.faceDown && !game.seeAll()" [peeked]="m.faceDown && game.seeAll()" />
          </div>
        }
        <div class="main-card" erasHoldPeek (peek)="openDetail(s)">
          <eras-game-card class="main" [imageUrl]="s.imageUrl" [foil]="s.finish ?? null" [name]="s.cardName ?? null" [materialsCount]="s.materials.length" />
        </div>
      </div>
      <!-- Its Recursos under it, as on the table: only their name and the effect they pass on (just the name if none) -->
      @for (r of resourceViews(); track r.id) {
        <div class="resource-row" erasHoldPeek (peek)="openDetail(r.slot)">
          <div class="resource" [class.name-only]="r.lines.length === 0" role="img" [attr.aria-label]="'Recurso: ' + r.name">
            @if (r.imageUrl) {
              <img [src]="r.imageUrl" alt="" />
            } @else {
              <span>{{ r.name }}</span>
            }
          </div>
        </div>
      }
    </div>
    <div class="effects">
      @if (facts().length) {
        <eras-card-facts [facts]="facts()" />
      }
      @if (s.unprogrammed) {
        <p class="unprogrammed" role="note"><eras-icon name="alert" /> Sin programar en el simulador: {{ s.unprogrammed }}. Se juega a mano.</p>
      }
      @if (modifiers(); as m) {
        <section class="panel modifiers" aria-label="Modificadores">
          <h4><eras-icon name="sparkles" /> Ahora</h4>
          @if (m.strength) {
            <p class="strength">Fuerza <strong>{{ m.strength.now }}</strong> <span class="muted">&nbsp;(original {{ m.strength.base }})</span></p>
          }
          @for (f of m.floating; track $index) {
            <p><span [class.gain]="f.strength > 0 || (f.keyword && f.strength >= 0)" [class.loss]="f.strength < 0">{{ f.text }}</span>@if (f.source) {<span class="muted"> · {{ f.source }}</span>}</p>
          }
          @if (m.continuous) {
            <p><span class="gain">{{ m.continuous }}</span><span class="muted"> · efecto continuo</span></p>
          }
          @if (m.manual) {
            <p><span [class.gain]="m.manual > 0" [class.loss]="m.manual < 0">{{ m.manual > 0 ? '+' : '' }}{{ m.manual }} de fuerza</span><span class="muted"> · ajuste manual</span></p>
          }
        </section>
      }
      <section class="panel">
        <h4><eras-icon name="zap" /> Efectos</h4>
        @for (e of sections().own; track $index) {
          <ng-container *ngTemplateOutlet="effect; context: { $implicit: e }" />
        } @empty {
          <p class="muted">Sin efectos.</p>
        }
      </section>
      @if (sections().link.length) {
        <section class="panel">
          <h4><eras-icon name="link" /> Efecto de enlace</h4>
          @for (e of sections().link; track $index) {
            <ng-container *ngTemplateOutlet="effect; context: { $implicit: e }" />
          }
        </section>
      }
      @if (sections().inherited.length) {
        <section class="panel">
          <h4><eras-icon name="layers" /> Efectos de sus recursos</h4>
          @for (e of sections().inherited; track $index) {
            <ng-container *ngTemplateOutlet="effect; context: { $implicit: e }" />
          }
        </section>
      }
      @if (sections().grants.length) {
        <section class="panel" aria-label="Recibe por enlace">
          <h4><eras-icon name="link" /> Recibe por enlace</h4>
          @for (e of sections().grants; track $index) {
            <ng-container *ngTemplateOutlet="effect; context: { $implicit: e }" />
          }
        </section>
      }
      @if (s.materials.length) {
        <section class="panel">
          <h4><eras-icon name="stack" /> Materiales ({{ s.materials.length }})</h4>
          <ul class="materials">
            @for (m of s.materials; track m.instanceId) {
              <li>
                @if (m.faceDown && !game.seeAll()) {
                  <span class="muted">Material bocabajo</span>
                } @else {
                  <button type="button" class="link" (click)="openDetail(m)"><eras-icon name="eye" /> {{ m.cardName ?? 'Material' }}</button>
                }
              </li>
            }
          </ul>
        </section>
      }
    </div>
    <ng-template #effect let-e>
      <eras-effect-line class="effect" [class.active]="e.active" [attr.aria-current]="e.active ? 'true' : null" [source]="e.source" [moment]="e.line.moment" [tags]="e.line.tags" [text]="e.line.text" [activeLabel]="e.active ? 'Se activa' : null" />
    </ng-template>
  `,
  styleUrl: './card-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardSheetComponent {
  protected readonly game = inject(GameStore);
  private readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** The card as it is now (follow it in the state: the sheet changes with it). */
  readonly slot = input.required<CardSlot>();
  readonly zone = input<ZoneName>('field');
  /** Its owner is the rival. */
  readonly opponent = input(false, { transform: booleanAttribute });
  /** The text of the effect that asks, lit up among its effects (its own, its Recursos', the ones it receives). */
  readonly activeText = input<string | null | undefined>(null);
  /** Stacked: the card, then its effects (a side panel). */
  readonly column = input(false, { transform: booleanAttribute });

  /** Metadata of a card of the game, by its file id. */
  private meta(cardId: string | null | undefined) {
    return this.cards.cards().find((c) => c.id === cardId)?.meta ?? null;
  }

  private lines(effects: Parameters<typeof effectLines>[0], keywords: Parameters<typeof effectLines>[1]): EffectLine[] {
    return effectLines(effects, keywords, this.cards.ref());
  }

  /** Its Recursos, with what each one gives it. */
  protected readonly resourceViews = computed(() =>
    this.slot().resources.map((r) => {
      const m = this.meta(r.cardId);
      return { id: r.instanceId, slot: r, name: r.cardName ?? 'Recurso', imageUrl: r.imageUrl, lines: this.lines(m?.inheritEffects, m?.inheritKeywordEffects) };
    }),
  );

  /**
   * Its effects by section (its own, its link effect, its Recursos', what it receives by link), the one that asks lit up:
   * the line of all of them closest to `activeText`.
   */
  protected readonly sections = computed(() => {
    const s = this.slot();
    const m = this.meta(s.cardId);
    const own = this.lines(m?.effects, m?.keywordEffects).map((line) => ({ line, source: null as string | null }));
    const link = this.lines(m?.formationEffects, m?.formationKeywordEffects).map((line) => ({ line, source: null as string | null }));
    const inherited = this.resourceViews().flatMap((r) => r.lines.map((line) => ({ line, source: r.name as string | null })));
    const field = (this.opponent() ? this.game.opponentState() : this.game.myState())?.field ?? [];
    const grants =
      this.zone() === 'field'
        ? formationGrants(s).flatMap((g) => {
            const gm = this.meta(field.find((c) => c.instanceId === g.sourceId)?.cardId);
            return this.lines(gm?.formationEffects, gm?.formationKeywordEffects).map((line) => ({ line, source: g.sourceName as string | null }));
          })
        : [];
    const all = [...own, ...link, ...inherited, ...grants];
    const active = matchingLine(
      all.map((e) => e.line),
      this.activeText(),
    );
    const mark = (list: { line: EffectLine; source: string | null }[], offset: number): SheetLine[] => list.map((e, i) => ({ ...e, active: offset + i === active }));
    return {
      own: mark(own, 0),
      link: mark(link, own.length),
      inherited: mark(inherited, own.length + link.length),
      grants: mark(grants, own.length + link.length + inherited.length),
    };
  });

  /**
   * What it has now beyond what is printed: its current strength, what effects gave or took for a while (with their
   * source), its continuous effects that hold and any manual adjustment. Null when there is nothing.
   */
  protected readonly modifiers = computed(() => {
    const s = this.slot();
    if (s.faceDown || this.zone() !== 'field') return null;
    const now = displayStrength(s);
    const strength = s.strength != null && now !== s.strength ? { base: s.strength, now } : null;
    const floating = s.floating ?? [];
    const gained = [...(s.continuousStrength ? [`fuerza ${s.continuousStrength > 0 ? '+' : ''}${s.continuousStrength}`] : []), ...(s.continuousKeywords ?? [])];
    const continuous = gained.length ? `Gana ${gained.join(', ')}` : null;
    const manual = s.strengthModifier || 0;
    return strength || floating.length || continuous || manual ? { strength, floating, continuous, manual } : null;
  });

  /** Its printed numbers at a glance; the strength as it is now (marked when it changed). */
  protected readonly facts = computed(() => {
    const s = this.slot();
    return slotFacts(s, { onField: this.zone() === 'field', visible: !s.faceDown || this.game.seeAll() });
  });

  /** A card of it in detail, as in the cards catalog. */
  protected openDetail(card: CardSlot): void {
    const catalog = this.cards.cards().find((c) => c.id === card.cardId);
    if (catalog) openCardDetailDialog(this.modal, [catalog]);
  }

  constructor() {
    // The lit effect in view, on a card with many effects
    afterRenderEffect(() => {
      this.sections();
      this.host.querySelector('.effect.active')?.scrollIntoView({ block: 'nearest' });
    });
  }
}
