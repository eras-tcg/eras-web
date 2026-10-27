import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Inline message (errors, confirmations). */
@Component({
  selector: 'eras-alert',
  template: '<ng-content />',
  styleUrl: './alert.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"tone-" + tone()',
    '[attr.role]': 'tone() === "danger" ? "alert" : "status"',
  },
})
export class AlertComponent {
  readonly tone = input<'info' | 'success' | 'danger'>('info');
}
