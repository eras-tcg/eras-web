import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { claimable, missionText } from '@data/missions/mission-rules';
import { MissionsStore } from '@data/missions/missions.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { HubScreenComponent } from './hub-screen.component';

/**
 * "Misiones" screen of the hub: today's missions and this week's, each with its progress, its gems and "Reclamar"
 * once done. Online games count for them (not solo mode).
 */
@Component({
  selector: 'eras-missions-page',
  imports: [HubScreenComponent, AlertComponent, IconComponent, SpinnerComponent, DecimalPipe, NgTemplateOutlet],
  template: `
    <eras-hub-screen title="Misiones">
      @if (missions.board(); as board) {
        @if (missions.error(); as message) {
          <eras-alert tone="danger">{{ message }}</eras-alert>
        }
        <ng-container [ngTemplateOutlet]="set" [ngTemplateOutletContext]="{ title: 'Diarias', when: 'Se renuevan mañana', list: board.daily, period: 'daily' }" />
        <ng-container [ngTemplateOutlet]="set" [ngTemplateOutletContext]="{ title: 'Semanales', when: 'Se renuevan el lunes', list: board.weekly, period: 'weekly' }" />
        <p class="note">Cuentan las partidas online (no el modo solo).</p>
      } @else {
        <eras-spinner />
      }
    </eras-hub-screen>

    <ng-template #set let-title="title" let-when="when" let-list="list" let-period="period">
      <section class="set">
        <header class="set-head">
          <h2>{{ title }}</h2>
          <span>{{ when }}</span>
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
                    @if (isDone(m)) {
                      <span class="claim">Reclamar</span>
                    }
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
}
