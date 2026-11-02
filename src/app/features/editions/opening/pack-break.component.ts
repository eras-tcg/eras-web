import { ChangeDetectionStrategy, Component, input } from '@angular/core';

interface Shard {
  /** clip-path polygon, in % of the pack. */
  clip: string;
  /** Where it flies (in % of the pack) and how much it turns. */
  dx: number;
  dy: number;
  rot: number;
}

interface Spark {
  angle: number;
  /** How far it flies, in px. */
  dist: number;
  size: number;
}

/** The pack cut in eight shards around a point a bit above its middle (50%, 45%); together they are the whole pack. */
const SHARDS: Shard[] = [
  { clip: '0 0, 40% 0, 50% 45%, 0 30%', dx: -90, dy: -80, rot: -38 },
  { clip: '40% 0, 75% 0, 50% 45%', dx: 10, dy: -120, rot: 22 },
  { clip: '75% 0, 100% 0, 100% 25%, 50% 45%', dx: 95, dy: -85, rot: 41 },
  { clip: '100% 25%, 100% 60%, 50% 45%', dx: 130, dy: 5, rot: 30 },
  { clip: '100% 60%, 100% 100%, 70% 100%, 50% 45%', dx: 90, dy: 95, rot: -34 },
  { clip: '70% 100%, 30% 100%, 50% 45%', dx: -5, dy: 130, rot: 18 },
  { clip: '30% 100%, 0 100%, 0 70%, 50% 45%', dx: -95, dy: 90, rot: 36 },
  { clip: '0 70%, 0 30%, 50% 45%', dx: -130, dy: -5, rot: -26 },
];

const SPARK_COUNT = 22;

/**
 * A pack breaking open, in `duration` ms: it charges (it shakes harder and harder while rays of light turn and glow
 * behind it), cracks (the cracks draw themselves and light leaks through), then shatters: a flash, its shards are
 * shot away turning and slow down exponentially, and sparks burst all around. Its color says nothing of the pack's type.
 */
@Component({
  selector: 'eras-pack-break',
  templateUrl: './pack-break.component.html',
  styleUrl: './pack-break.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--art]': 'art()', '[style.--break]': 'duration() + "ms"', 'aria-hidden': 'true' },
})
export class PackBreakComponent {
  readonly art = input<string | null>(null);
  readonly duration = input(2600);

  protected readonly shards = SHARDS;
  /** Drawn once per pack, so no two bursts look alike. */
  protected readonly sparks: Spark[] = Array.from({ length: SPARK_COUNT }, (_, i) => ({
    angle: (360 / SPARK_COUNT) * i + Math.random() * 12 - 6,
    dist: 120 + Math.random() * 200,
    size: 3 + Math.random() * 6,
  }));
}
