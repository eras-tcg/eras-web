import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MissionsStore, claimable } from '@core/missions/missions.store';
import { missionText } from '@data/missions/mission-rules';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { HubScreenComponent } from './hub-screen.component';

/**
 * "Misiones" screen of the hub: today's missions and this week's (with the day they change), each with its progress,
 * its gems, which light up to be claimed once done. Online games count for them (not solo mode).
 */
@Component({
  selector: 'eras-missions-page',
  imports: [HubScreenComponent, AlertComponent, IconComponent, SpinnerComponent, DatePipe, DecimalPipe, NgTemplateOutlet],
  template: `
    <eras-hub-screen title="Misiones">
      @if (missions.board(); as board) {
        @if (missions.error(); as message) {
          <eras-alert tone="danger">{{ message }}</eras-alert>
        }
        <ng-container [ngTemplateOutlet]="set" [ngTemplateOutletContext]="{ title: 'Diarias', ends: null, list: board.daily, period: 'daily' }" />
        <ng-container [ngTemplateOutlet]="set" [ngTemplateOutletContext]="{ title: 'Semanales', ends: weekEnds(board.nextWeek), list: board.weekly, period: 'weekly' }" />
      } @else {
        <eras-spinner />
      }
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
  protected readonly text = missionText;
  protected readonly isDone = claimable;

  constructor() {
    void this.missions.load();
  }

  /** The day the weekly missions change (the server's YYYY-MM-DD), as a local date. */
  protected weekEnds(day: string): Date {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}
