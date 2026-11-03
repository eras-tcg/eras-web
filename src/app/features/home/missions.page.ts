import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MissionsStore, claimable } from '@core/missions/missions.store';
import { WelcomeStep } from '@core/missions/progression.model';
import { ProgressionStore, STRUCTURE_STEP, milestoneClaimable, stepClaimable } from '@core/missions/progression.store';
import { missionText } from '@data/missions/mission-rules';
import { badgeName, milestoneText, milestoneTitle, stepText } from '@data/missions/progression-rules';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { TabItem, TabsComponent } from '@ui/surfaces/tabs/tabs.component';
import { HubScreenComponent } from './hub-screen.component';
import { MissionGuideFlow } from './mission-guide-flow';
import { WelcomeFlow } from './welcome-flow';

type MissionsTab = 'periodic' | 'progress';

/**
 * "Misiones" screen of the hub, in two tabs. "Diarias y semanales": today's missions and this week's (with the day
 * they change), each with its progress and its gems, which light up to be claimed once done; online games count for
 * them (not solo mode). "Progreso": the "Bienvenida" chain, claimed in order (its first two steps go through
 * WelcomeFlow: the greeting, then the structure deck picker), and the milestones, one tier after another. It opens on
 * "Progreso" unless only daily or weekly missions wait to be claimed.
 */
@Component({
  selector: 'eras-missions-page',
  imports: [HubScreenComponent, AlertComponent, IconComponent, SpinnerComponent, TabsComponent, DatePipe, DecimalPipe, NgTemplateOutlet],
  template: `
    <eras-hub-screen title="Misiones">
      <eras-tabs label="Tipos de misiones" [tabs]="tabs()" [selected]="tab()" (selectedChange)="chosen.set($any($event))" />

      <!-- The tabs stay; a long list scrolls inside the column -->
      <div class="scroll">
      @if (tab() === 'periodic') {
        @if (missions.board(); as board) {
          @if (missions.error(); as message) {
            <eras-alert tone="danger">{{ message }}</eras-alert>
          }
          <ng-container [ngTemplateOutlet]="set" [ngTemplateOutletContext]="{ title: 'Diarias', ends: null, list: board.daily, period: 'daily' }" />
          <ng-container [ngTemplateOutlet]="set" [ngTemplateOutletContext]="{ title: 'Semanales', ends: weekEnds(board.nextWeek), list: board.weekly, period: 'weekly' }" />
        } @else {
          <eras-spinner />
        }
      } @else {
        @if (progression.board(); as board) {
          @if (progression.error(); as message) {
            <eras-alert tone="danger">{{ message }}</eras-alert>
          }
          @if (board.badges.length) {
            <p class="badges">
              @for (b of board.badges; track b) {
                <span class="badge"><eras-icon name="shield" /> {{ badge(b) }}</span>
              }
            </p>
          }
          @if (!progression.welcomeDone()) {
            <section class="set">
              <header class="set-head">
                <h2>Bienvenida</h2>
                <span class="ends">{{ stepsClaimed(board.welcome) }} / {{ board.welcome.length }}</span>
              </header>
              <ol class="list">
                @for (s of board.welcome; track s.id) {
                  <li class="mission" [class.done]="stepReady(s)" [class.claimed]="s.claimed" [class.locked]="s.locked">
                    <span class="text">
                      <span class="what">{{ step(s.id).title }}</span>
                      <span class="hint">{{ step(s.id).hint }}</span>
                      @if (!s.locked && !s.claimed && s.target > 1) {
                        <span class="bar" aria-hidden="true"><span class="fill" [style.inline-size.%]="(s.progress / s.target) * 100"></span></span>
                        <span class="count">{{ s.progress }} / {{ s.target }}</span>
                      }
                    </span>
                    @if (s.claimed) {
                      <!-- Done again for practice: the section and its guide, no gems (then only the check, for room) -->
                      @if (!canRepeat(s)) {
                        <span class="reward claimed-tag"><eras-icon name="check" /> Reclamada</span>
                      } @else {
                        <span class="reward claimed-tag compact" title="Reclamada" aria-label="Reclamada"><eras-icon name="check" /></span>
                        <button type="button" class="reward go repeat" [attr.aria-label]="'Repetir: ' + step(s.id).title" (click)="repeat(s)">
                          <eras-icon name="refresh" /> Repetir
                        </button>
                      }
                    } @else if (s.locked) {
                      <span class="reward locked-tag" aria-label="Bloqueada"><eras-icon name="lock" /></span>
                    } @else if (s.id === 'welcome') {
                      <button type="button" class="reward" [disabled]="!!progression.claiming()" (click)="welcome.start()">
                        <eras-icon name="sparkles" /> Abrir
                      </button>
                    } @else if (s.id === structureStep && s.gems === 0) {
                      <button type="button" class="reward" [disabled]="!!progression.claiming()" (click)="welcome.pickStructure()">
                        @if (progression.claiming() === 'welcome|' + s.id) {
                          <eras-spinner />
                        } @else {
                          <eras-icon name="structure" /> Elegir
                        }
                      </button>
                    } @else if (!stepReady(s)) {
                      <button type="button" class="reward go" (click)="go(s)">Ir <eras-icon name="chevron-right" /></button>
                    } @else {
                      <button
                        type="button"
                        class="reward"
                        [disabled]="!!progression.claiming()"
                        [attr.aria-label]="'Reclamar ' + s.gems + ' gemas: ' + step(s.id).title"
                        (click)="progression.claimStep(s.id)"
                      >
                        @if (progression.claiming() === 'welcome|' + s.id) {
                          <eras-spinner />
                        } @else {
                          <eras-icon name="gem" /> {{ s.gems }}
                        }
                      </button>
                    }
                  </li>
                }
              </ol>
            </section>
          }

          <section class="set">
            <header class="set-head"><h2>Hitos</h2></header>
            <ul class="list">
              @for (m of board.milestones; track m.id) {
                <li class="mission" [class.done]="milestoneReady(m)" [class.claimed]="m.maxed">
                  <span class="text">
                    <span class="what">{{ milestoneTitle(m) }} <span class="tiers">{{ m.tier }} / {{ m.tiers }}</span></span>
                    <span class="hint">{{ milestoneText(m) }}</span>
                    <span class="bar" aria-hidden="true"><span class="fill" [style.inline-size.%]="(m.progress / m.target) * 100"></span></span>
                    <span class="count">{{ m.progress | number: '1.0-0' : 'es' }} / {{ m.target | number: '1.0-0' : 'es' }}</span>
                  </span>
                  @if (m.maxed) {
                    <span class="reward claimed-tag"><eras-icon name="trophy" /> Completa</span>
                  } @else {
                    <button
                      type="button"
                      class="reward"
                      [disabled]="!milestoneReady(m) || !!progression.claiming()"
                      [attr.aria-label]="'Reclamar ' + m.gems + ' gemas: ' + milestoneTitle(m)"
                      (click)="progression.claimMilestone(m.id)"
                    >
                      @if (progression.claiming() === 'milestone|' + m.id) {
                        <eras-spinner />
                      } @else {
                        <eras-icon name="gem" /> {{ m.gems }}
                      }
                    </button>
                  }
                </li>
              }
            </ul>
          </section>
        } @else {
          <eras-spinner />
        }
      }
      </div>
    </eras-hub-screen>

    <ng-template #set let-title="title" let-ends="ends" let-list="list" let-period="period">
      <section class="set">
        <header class="set-head">
          <h2>{{ title }}</h2>
          <!-- When the weekly ones change -->
          @if (ends) {
            <span class="ends" [attr.title]="'Se renuevan el ' + (ends | date: 'EEEE d MMMM' : '' : 'es')">
              <eras-icon name="clock" /> {{ ends | date: 'EEE d MMM' : '' : 'es' }}
            </span>
          }
        </header>
        <ul class="list">
          @for (m of $any(list); track m.id) {
            <li class="mission" [class.done]="isDone(m)" [class.claimed]="m.claimed">
              <span class="text">
                <span class="what">{{ text(m) }}</span>
                <span class="bar" aria-hidden="true"><span class="fill" [style.inline-size.%]="(m.progress / m.target) * 100"></span></span>
                <span class="count">{{ m.progress | number: '1.0-0' : 'es' }} / {{ m.target | number: '1.0-0' : 'es' }}</span>
              </span>
              @if (m.claimed) {
                <span class="reward claimed-tag"><eras-icon name="check" /> Reclamada</span>
              } @else {
                <button
                  type="button"
                  class="reward"
                  [disabled]="!isDone(m) || !!missions.claiming()"
                  [attr.aria-label]="'Reclamar ' + m.gems + ' gemas: ' + text(m)"
                  (click)="missions.claim(period, m.id)"
                >
                  @if (missions.claiming() === period + '|' + m.id) {
                    <eras-spinner />
                  } @else {
                    <eras-icon name="gem" /> {{ m.gems }}
                  }
                </button>
              }
            </li>
          }
        </ul>
      </section>
    </ng-template>
  `,
  styleUrl: './missions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissionsPage {
  protected readonly missions = inject(MissionsStore);
  protected readonly progression = inject(ProgressionStore);
  protected readonly welcome = inject(WelcomeFlow);
  private readonly router = inject(Router);
  private readonly guide = inject(MissionGuideFlow);

  protected readonly text = missionText;
  protected readonly isDone = claimable;
  protected readonly step = stepText;
  protected readonly stepReady = stepClaimable;
  protected readonly milestoneReady = milestoneClaimable;
  protected readonly milestoneTitle = milestoneTitle;
  protected readonly milestoneText = milestoneText;
  protected readonly badge = badgeName;
  protected readonly structureStep = STRUCTURE_STEP;

  /**
   * The tab picked; until then "Progreso" (also while it loads, so the screen does not jump), unless it has nothing
   * left to do or claim and a daily or weekly mission waits to be claimed.
   */
  protected readonly chosen = signal<MissionsTab | null>(null);
  protected readonly tab = computed<MissionsTab>(() => {
    const picked = this.chosen();
    if (picked) return picked;
    const progressIdle = !!this.progression.board() && this.progression.welcomeDone() && this.progression.waiting() === 0;
    return progressIdle && this.missions.waiting() > 0 ? 'periodic' : 'progress';
  });
  protected readonly tabs = computed<TabItem[]>(() => [
    { key: 'periodic', label: this.label('Diarias y semanales', this.missions.waiting()) },
    { key: 'progress', label: this.label('Progreso', this.progression.waiting()) },
  ]);

  constructor() {
    void this.missions.load();
    void this.progression.load();
  }

  /** The day the weekly missions change (the server's YYYY-MM-DD), as a local date. */
  protected weekEnds(day: string): Date {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  protected stepsClaimed(steps: WelcomeStep[]): number {
    return steps.filter((s) => s.claimed).length;
  }

  /** A claimed step can be done again (without gems): the greeting and the structure decks, or its section. */
  protected canRepeat(s: WelcomeStep): boolean {
    return s.id === 'welcome' || s.id === STRUCTURE_STEP || stepText(s.id).route !== '/missions';
  }

  /** Seen again from "Progreso", with nothing claimed. */
  protected repeat(s: WelcomeStep): void {
    if (s.id === 'welcome' || s.id === STRUCTURE_STEP) void this.welcome.replay();
    else void this.go(s);
  }

  /** Opens the section a step is done in and, coming from here only, tells what that section is for. */
  protected go(s: WelcomeStep): Promise<void> {
    return this.guide.open(s.id, stepText(s.id).route);
  }

  private label(name: string, waiting: number): string {
    return waiting ? `${name} (${waiting})` : name;
  }
}
