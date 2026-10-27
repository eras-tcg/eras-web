import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface RangeValue {
  min: number | null;
  max: number | null;
}

/**
 * Two-thumb slider over 0..`max`. A thumb at its end of the track means "no limit",
 * so the emitted bound is `null` and items without the value are not excluded.
 */
@Component({
  selector: 'eras-range-slider',
  template: `
    <div class="label">
      <span>{{ label() }}</span>
      <span class="value">{{ summary() }}</span>
    </div>
    <div class="track" [style.--from]="fromPct()" [style.--to]="toPct()">
      <input
        type="range"
        min="0"
        [max]="max()"
        step="1"
        [value]="low()"
        [attr.aria-label]="label() + ' mínimo'"
        (input)="setLow($any($event.target).valueAsNumber)"
      />
      <input
        type="range"
        min="0"
        [max]="max()"
        step="1"
        [value]="high()"
        [attr.aria-label]="label() + ' máximo'"
        (input)="setHigh($any($event.target).valueAsNumber)"
      />
    </div>
  `,
  styleUrl: './range-slider.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RangeSliderComponent {
  readonly label = input.required<string>();
  readonly max = input.required<number>();
  readonly value = input<RangeValue>({ min: null, max: null });
  readonly valueChange = output<RangeValue>();

  protected readonly low = computed(() => this.value().min ?? 0);
  protected readonly high = computed(() => Math.min(this.value().max ?? this.max(), this.max()));
  protected readonly fromPct = computed(() => `${(this.low() / (this.max() || 1)) * 100}%`);
  protected readonly toPct = computed(() => `${(this.high() / (this.max() || 1)) * 100}%`);
  protected readonly summary = computed(() =>
    this.value().min === null && this.value().max === null ? 'Todos' : `${this.low()}–${this.high()}`,
  );

  protected setLow(v: number): void {
    this.emit(v, Math.max(v, this.high()));
  }

  protected setHigh(v: number): void {
    this.emit(Math.min(v, this.low()), v);
  }

  private emit(low: number, high: number): void {
    this.valueChange.emit({ min: low > 0 ? low : null, max: high < this.max() ? high : null });
  }
}
