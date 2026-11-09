import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

const LABELS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** The positions of each side, from the middle outwards (indexes of LABELS): yours to the left, the rival's to the right. */
const MINE = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const THEIRS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/**
 * Shared gem bar: 21 positions (10…0…10); the marker sits on `index`. Clicking a position moves it.
 * Phones in landscape (no room for 21 buttons): the value in the middle, and on each side a bar of 10 steps that fills
 * from the middle towards the side the gems are on (green yours, red the rival's), as the marker on the table; its
 * steps can be clicked as the positions.
 */
@Component({
  selector: 'eras-shared-bar',
  template: `
    <div class="bar" role="radiogroup" aria-label="Contador compartido de gemas">
      @for (label of labels; track $index; let i = $index) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="i === index()"
          [attr.aria-label]="(i < 10 ? 'Tu lado ' : i > 10 ? 'Lado rival ' : '') + label"
          [class.active]="i === index()"
          [class.mine]="i < 10"
          [class.theirs]="i > 10"
          (click)="positionSelected.emit(i)"
        >
          {{ label }}
        </button>
      }
    </div>

    <div class="compact" aria-hidden="true">
      <div class="side mine">
        @for (i of mine; track i) {
          <button type="button" tabindex="-1" class="step" [class.lit]="index() <= i" (click)="positionSelected.emit(i)"></button>
        }
      </div>
      <button type="button" tabindex="-1" class="value" [class.mine]="index() < 10" [class.theirs]="index() > 10" (click)="positionSelected.emit(10)">
        {{ value() }}
      </button>
      <div class="side theirs">
        @for (i of theirs; track i) {
          <button type="button" tabindex="-1" class="step" [class.lit]="index() >= i" (click)="positionSelected.emit(i)"></button>
        }
      </div>
    </div>
  `,
  styles: `
    /* Emerald-cut gems (outline, step bands lit from above, the table, facet lines and a shine), drawn once: long ones
       for the bar's steps, an upright one edged in gold for the value — green yours, red the rival's, off a dull grey */
    :host {
      --bar-gem-green: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-1.2 -1.2 62.4 24.4' preserveAspectRatio='none'%3E%3Cpolygon points='5,0 55,0 60,5 60,17 55,22 5,22 0,17 0,5' fill='%2322c55e'/%3E%3Cpolygon points='5,0 55,0 52.29,3.96 7.71,3.96' fill='%23d1fae5'/%3E%3Cpolygon points='55,0 60,5 56.04,7.71 52.29,3.96' fill='%23d1fae5'/%3E%3Cpolygon points='60,5 60,17 56.04,14.29 56.04,7.71' fill='%234ade80'/%3E%3Cpolygon points='60,17 55,22 52.29,18.04 56.04,14.29' fill='%230f6b33'/%3E%3Cpolygon points='55,22 5,22 7.71,18.04 52.29,18.04' fill='%230f6b33'/%3E%3Cpolygon points='5,22 0,17 3.96,14.29 7.71,18.04' fill='%230f6b33'/%3E%3Cpolygon points='0,17 0,5 3.96,7.71 3.96,14.29' fill='%234ade80'/%3E%3Cpolygon points='0,5 5,0 7.71,3.96 3.96,7.71' fill='%23d1fae5'/%3E%3Cpolygon points='7.71,3.96 52.29,3.96 56.04,7.71 56.04,14.29 52.29,18.04 7.71,18.04 3.96,14.29 3.96,7.71' fill='%2322c55e'/%3E%3Cpolygon points='7.71,18.04 3.96,14.29 3.96,7.71 7.71,3.96 52.29,3.96 56.04,7.71 56.04,14.29 52.29,18.04' fill='%2322c55e'/%3E%3Cpolygon points='9.98,7.48 50.02,7.48 52.52,9.98 52.52,12.02 50.02,14.52 9.98,14.52 7.48,12.02 7.48,9.98' fill='%2386efac'/%3E%3Cpolygon points='52.52,12.02 50.02,14.52 9.98,14.52 7.48,12.02 7.48,11 52.52,11' fill='%2316a34a' opacity='0.55'/%3E%3Cline x1='5' y1='0' x2='9.98' y2='7.48' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='55' y1='0' x2='50.02' y2='7.48' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='60' y1='5' x2='52.52' y2='9.98' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='60' y1='17' x2='52.52' y2='12.02' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='55' y1='22' x2='50.02' y2='14.52' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='5' y1='22' x2='9.98' y2='14.52' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='0' y1='17' x2='7.48' y2='12.02' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='0' y1='5' x2='7.48' y2='9.98' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cpolygon points='7.71,3.96 52.29,3.96 56.04,7.71 56.04,14.29 52.29,18.04 7.71,18.04 3.96,14.29 3.96,7.71' fill='none' stroke='%23fff' stroke-opacity='0.3' stroke-width='0.6'/%3E%3Cpolygon points='9.98,7.48 50.02,7.48 52.52,9.98 52.52,12.02 50.02,14.52 9.98,14.52 7.48,12.02 7.48,9.98' fill='none' stroke='%23fff' stroke-opacity='0.45' stroke-width='0.6'/%3E%3Crect x='14.7848' y='8.7472' width='12.8128' height='0.9856' rx='0.4928' fill='%23fff' fill-opacity='0.7'/%3E%3Cpolygon points='5,0 55,0 60,5 60,17 55,22 5,22 0,17 0,5' fill='none' stroke='%23e9fff1' stroke-width='1.2' stroke-linejoin='round'/%3E%3C/svg%3E");
      --bar-gem-red: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-1.2 -1.2 62.4 24.4' preserveAspectRatio='none'%3E%3Cpolygon points='5,0 55,0 60,5 60,17 55,22 5,22 0,17 0,5' fill='%23e5484d'/%3E%3Cpolygon points='5,0 55,0 52.29,3.96 7.71,3.96' fill='%23fee2e2'/%3E%3Cpolygon points='55,0 60,5 56.04,7.71 52.29,3.96' fill='%23fee2e2'/%3E%3Cpolygon points='60,5 60,17 56.04,14.29 56.04,7.71' fill='%23f87171'/%3E%3Cpolygon points='60,17 55,22 52.29,18.04 56.04,14.29' fill='%237a1b1e'/%3E%3Cpolygon points='55,22 5,22 7.71,18.04 52.29,18.04' fill='%237a1b1e'/%3E%3Cpolygon points='5,22 0,17 3.96,14.29 7.71,18.04' fill='%237a1b1e'/%3E%3Cpolygon points='0,17 0,5 3.96,7.71 3.96,14.29' fill='%23f87171'/%3E%3Cpolygon points='0,5 5,0 7.71,3.96 3.96,7.71' fill='%23fee2e2'/%3E%3Cpolygon points='7.71,3.96 52.29,3.96 56.04,7.71 56.04,14.29 52.29,18.04 7.71,18.04 3.96,14.29 3.96,7.71' fill='%23e5484d'/%3E%3Cpolygon points='7.71,18.04 3.96,14.29 3.96,7.71 7.71,3.96 52.29,3.96 56.04,7.71 56.04,14.29 52.29,18.04' fill='%23e5484d'/%3E%3Cpolygon points='9.98,7.48 50.02,7.48 52.52,9.98 52.52,12.02 50.02,14.52 9.98,14.52 7.48,12.02 7.48,9.98' fill='%23fca5a5'/%3E%3Cpolygon points='52.52,12.02 50.02,14.52 9.98,14.52 7.48,12.02 7.48,11 52.52,11' fill='%23c0353a' opacity='0.55'/%3E%3Cline x1='5' y1='0' x2='9.98' y2='7.48' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='55' y1='0' x2='50.02' y2='7.48' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='60' y1='5' x2='52.52' y2='9.98' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='60' y1='17' x2='52.52' y2='12.02' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='55' y1='22' x2='50.02' y2='14.52' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='5' y1='22' x2='9.98' y2='14.52' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='0' y1='17' x2='7.48' y2='12.02' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='0' y1='5' x2='7.48' y2='9.98' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cpolygon points='7.71,3.96 52.29,3.96 56.04,7.71 56.04,14.29 52.29,18.04 7.71,18.04 3.96,14.29 3.96,7.71' fill='none' stroke='%23fff' stroke-opacity='0.3' stroke-width='0.6'/%3E%3Cpolygon points='9.98,7.48 50.02,7.48 52.52,9.98 52.52,12.02 50.02,14.52 9.98,14.52 7.48,12.02 7.48,9.98' fill='none' stroke='%23fff' stroke-opacity='0.45' stroke-width='0.6'/%3E%3Crect x='14.7848' y='8.7472' width='12.8128' height='0.9856' rx='0.4928' fill='%23fff' fill-opacity='0.7'/%3E%3Cpolygon points='5,0 55,0 60,5 60,17 55,22 5,22 0,17 0,5' fill='none' stroke='%23fff0f0' stroke-width='1.2' stroke-linejoin='round'/%3E%3C/svg%3E");
      --bar-gem-off: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-1.2 -1.2 62.4 24.4' preserveAspectRatio='none'%3E%3Cpolygon points='5,0 55,0 60,5 60,17 55,22 5,22 0,17 0,5' fill='%23353a45'/%3E%3Cpolygon points='5,0 55,0 52.29,3.96 7.71,3.96' fill='%237c8290'/%3E%3Cpolygon points='55,0 60,5 56.04,7.71 52.29,3.96' fill='%237c8290'/%3E%3Cpolygon points='60,5 60,17 56.04,14.29 56.04,7.71' fill='%234b5160'/%3E%3Cpolygon points='60,17 55,22 52.29,18.04 56.04,14.29' fill='%2312151a'/%3E%3Cpolygon points='55,22 5,22 7.71,18.04 52.29,18.04' fill='%2312151a'/%3E%3Cpolygon points='5,22 0,17 3.96,14.29 7.71,18.04' fill='%2312151a'/%3E%3Cpolygon points='0,17 0,5 3.96,7.71 3.96,14.29' fill='%234b5160'/%3E%3Cpolygon points='0,5 5,0 7.71,3.96 3.96,7.71' fill='%237c8290'/%3E%3Cpolygon points='7.71,3.96 52.29,3.96 56.04,7.71 56.04,14.29 52.29,18.04 7.71,18.04 3.96,14.29 3.96,7.71' fill='%23353a45'/%3E%3Cpolygon points='7.71,18.04 3.96,14.29 3.96,7.71 7.71,3.96 52.29,3.96 56.04,7.71 56.04,14.29 52.29,18.04' fill='%23353a45'/%3E%3Cpolygon points='9.98,7.48 50.02,7.48 52.52,9.98 52.52,12.02 50.02,14.52 9.98,14.52 7.48,12.02 7.48,9.98' fill='%234a505c'/%3E%3Cpolygon points='52.52,12.02 50.02,14.52 9.98,14.52 7.48,12.02 7.48,11 52.52,11' fill='%232b3039' opacity='0.55'/%3E%3Cline x1='5' y1='0' x2='9.98' y2='7.48' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='55' y1='0' x2='50.02' y2='7.48' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='60' y1='5' x2='52.52' y2='9.98' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='60' y1='17' x2='52.52' y2='12.02' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='55' y1='22' x2='50.02' y2='14.52' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='5' y1='22' x2='9.98' y2='14.52' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='0' y1='17' x2='7.48' y2='12.02' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cline x1='0' y1='5' x2='7.48' y2='9.98' stroke='%23fff' stroke-opacity='0.35' stroke-width='0.6'/%3E%3Cpolygon points='7.71,3.96 52.29,3.96 56.04,7.71 56.04,14.29 52.29,18.04 7.71,18.04 3.96,14.29 3.96,7.71' fill='none' stroke='%23fff' stroke-opacity='0.3' stroke-width='0.6'/%3E%3Cpolygon points='9.98,7.48 50.02,7.48 52.52,9.98 52.52,12.02 50.02,14.52 9.98,14.52 7.48,12.02 7.48,9.98' fill='none' stroke='%23fff' stroke-opacity='0.45' stroke-width='0.6'/%3E%3Crect x='14.7848' y='8.7472' width='12.8128' height='0.9856' rx='0.4928' fill='%23fff' fill-opacity='0.7'/%3E%3Cpolygon points='5,0 55,0 60,5 60,17 55,22 5,22 0,17 0,5' fill='none' stroke='%236b7280' stroke-width='1.2' stroke-linejoin='round'/%3E%3C/svg%3E");
      --big-gem-green: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-2.4 -2.4 44.8 58.8' preserveAspectRatio='none'%3E%3Cpolygon points='9,0 31,0 40,9 40,45 31,54 9,54 0,45 0,9' fill='%2322c55e'/%3E%3Cpolygon points='9,0 31,0 26.05,7.2 13.95,7.2' fill='%23d1fae5'/%3E%3Cpolygon points='31,0 40,9 32.8,13.95 26.05,7.2' fill='%23d1fae5'/%3E%3Cpolygon points='40,9 40,45 32.8,40.05 32.8,13.95' fill='%234ade80'/%3E%3Cpolygon points='40,45 31,54 26.05,46.8 32.8,40.05' fill='%230f6b33'/%3E%3Cpolygon points='31,54 9,54 13.95,46.8 26.05,46.8' fill='%230f6b33'/%3E%3Cpolygon points='9,54 0,45 7.2,40.05 13.95,46.8' fill='%230f6b33'/%3E%3Cpolygon points='0,45 0,9 7.2,13.95 7.2,40.05' fill='%234ade80'/%3E%3Cpolygon points='0,9 9,0 13.95,7.2 7.2,13.95' fill='%23d1fae5'/%3E%3Cpolygon points='13.95,7.2 26.05,7.2 32.8,13.95 32.8,40.05 26.05,46.8 13.95,46.8 7.2,40.05 7.2,13.95' fill='%2322c55e'/%3E%3Cpolygon points='13.95,46.8 7.2,40.05 7.2,13.95 13.95,7.2 26.05,7.2 32.8,13.95 32.8,40.05 26.05,46.8' fill='%2322c55e'/%3E%3Cpolygon points='18.1,13.6 21.9,13.6 26.4,18.1 26.4,35.9 21.9,40.4 18.1,40.4 13.6,35.9 13.6,18.1' fill='%2386efac'/%3E%3Cpolygon points='26.4,35.9 21.9,40.4 18.1,40.4 13.6,35.9 13.6,27 26.4,27' fill='%2316a34a' opacity='0.55'/%3E%3Cline x1='9' y1='0' x2='18.1' y2='13.6' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='31' y1='0' x2='21.9' y2='13.6' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='40' y1='9' x2='26.4' y2='18.1' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='40' y1='45' x2='26.4' y2='35.9' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='31' y1='54' x2='21.9' y2='40.4' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='9' y1='54' x2='18.1' y2='40.4' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='0' y1='45' x2='13.6' y2='35.9' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='0' y1='9' x2='13.6' y2='18.1' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cpolygon points='13.95,7.2 26.05,7.2 32.8,13.95 32.8,40.05 26.05,46.8 13.95,46.8 7.2,40.05 7.2,13.95' fill='none' stroke='%23fff' stroke-opacity='0.3' stroke-width='1.2'/%3E%3Cpolygon points='18.1,13.6 21.9,13.6 26.4,18.1 26.4,35.9 21.9,40.4 18.1,40.4 13.6,35.9 13.6,18.1' fill='none' stroke='%23fff' stroke-opacity='0.45' stroke-width='1.2'/%3E%3Crect x='18.556' y='18.424' width='1.216' height='3.752' rx='1.876' fill='%23fff' fill-opacity='0.7'/%3E%3Cpolygon points='9,0 31,0 40,9 40,45 31,54 9,54 0,45 0,9' fill='none' stroke='%23c9a24b' stroke-width='2.4' stroke-linejoin='round'/%3E%3C/svg%3E");
      --big-gem-red: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-2.4 -2.4 44.8 58.8' preserveAspectRatio='none'%3E%3Cpolygon points='9,0 31,0 40,9 40,45 31,54 9,54 0,45 0,9' fill='%23e5484d'/%3E%3Cpolygon points='9,0 31,0 26.05,7.2 13.95,7.2' fill='%23fee2e2'/%3E%3Cpolygon points='31,0 40,9 32.8,13.95 26.05,7.2' fill='%23fee2e2'/%3E%3Cpolygon points='40,9 40,45 32.8,40.05 32.8,13.95' fill='%23f87171'/%3E%3Cpolygon points='40,45 31,54 26.05,46.8 32.8,40.05' fill='%237a1b1e'/%3E%3Cpolygon points='31,54 9,54 13.95,46.8 26.05,46.8' fill='%237a1b1e'/%3E%3Cpolygon points='9,54 0,45 7.2,40.05 13.95,46.8' fill='%237a1b1e'/%3E%3Cpolygon points='0,45 0,9 7.2,13.95 7.2,40.05' fill='%23f87171'/%3E%3Cpolygon points='0,9 9,0 13.95,7.2 7.2,13.95' fill='%23fee2e2'/%3E%3Cpolygon points='13.95,7.2 26.05,7.2 32.8,13.95 32.8,40.05 26.05,46.8 13.95,46.8 7.2,40.05 7.2,13.95' fill='%23e5484d'/%3E%3Cpolygon points='13.95,46.8 7.2,40.05 7.2,13.95 13.95,7.2 26.05,7.2 32.8,13.95 32.8,40.05 26.05,46.8' fill='%23e5484d'/%3E%3Cpolygon points='18.1,13.6 21.9,13.6 26.4,18.1 26.4,35.9 21.9,40.4 18.1,40.4 13.6,35.9 13.6,18.1' fill='%23fca5a5'/%3E%3Cpolygon points='26.4,35.9 21.9,40.4 18.1,40.4 13.6,35.9 13.6,27 26.4,27' fill='%23c0353a' opacity='0.55'/%3E%3Cline x1='9' y1='0' x2='18.1' y2='13.6' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='31' y1='0' x2='21.9' y2='13.6' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='40' y1='9' x2='26.4' y2='18.1' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='40' y1='45' x2='26.4' y2='35.9' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='31' y1='54' x2='21.9' y2='40.4' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='9' y1='54' x2='18.1' y2='40.4' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='0' y1='45' x2='13.6' y2='35.9' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='0' y1='9' x2='13.6' y2='18.1' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cpolygon points='13.95,7.2 26.05,7.2 32.8,13.95 32.8,40.05 26.05,46.8 13.95,46.8 7.2,40.05 7.2,13.95' fill='none' stroke='%23fff' stroke-opacity='0.3' stroke-width='1.2'/%3E%3Cpolygon points='18.1,13.6 21.9,13.6 26.4,18.1 26.4,35.9 21.9,40.4 18.1,40.4 13.6,35.9 13.6,18.1' fill='none' stroke='%23fff' stroke-opacity='0.45' stroke-width='1.2'/%3E%3Crect x='18.556' y='18.424' width='1.216' height='3.752' rx='1.876' fill='%23fff' fill-opacity='0.7'/%3E%3Cpolygon points='9,0 31,0 40,9 40,45 31,54 9,54 0,45 0,9' fill='none' stroke='%23c9a24b' stroke-width='2.4' stroke-linejoin='round'/%3E%3C/svg%3E");
      --big-gem-off: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-2.4 -2.4 44.8 58.8' preserveAspectRatio='none'%3E%3Cpolygon points='9,0 31,0 40,9 40,45 31,54 9,54 0,45 0,9' fill='%23353a45'/%3E%3Cpolygon points='9,0 31,0 26.05,7.2 13.95,7.2' fill='%237c8290'/%3E%3Cpolygon points='31,0 40,9 32.8,13.95 26.05,7.2' fill='%237c8290'/%3E%3Cpolygon points='40,9 40,45 32.8,40.05 32.8,13.95' fill='%234b5160'/%3E%3Cpolygon points='40,45 31,54 26.05,46.8 32.8,40.05' fill='%2312151a'/%3E%3Cpolygon points='31,54 9,54 13.95,46.8 26.05,46.8' fill='%2312151a'/%3E%3Cpolygon points='9,54 0,45 7.2,40.05 13.95,46.8' fill='%2312151a'/%3E%3Cpolygon points='0,45 0,9 7.2,13.95 7.2,40.05' fill='%234b5160'/%3E%3Cpolygon points='0,9 9,0 13.95,7.2 7.2,13.95' fill='%237c8290'/%3E%3Cpolygon points='13.95,7.2 26.05,7.2 32.8,13.95 32.8,40.05 26.05,46.8 13.95,46.8 7.2,40.05 7.2,13.95' fill='%23353a45'/%3E%3Cpolygon points='13.95,46.8 7.2,40.05 7.2,13.95 13.95,7.2 26.05,7.2 32.8,13.95 32.8,40.05 26.05,46.8' fill='%23353a45'/%3E%3Cpolygon points='18.1,13.6 21.9,13.6 26.4,18.1 26.4,35.9 21.9,40.4 18.1,40.4 13.6,35.9 13.6,18.1' fill='%234a505c'/%3E%3Cpolygon points='26.4,35.9 21.9,40.4 18.1,40.4 13.6,35.9 13.6,27 26.4,27' fill='%232b3039' opacity='0.55'/%3E%3Cline x1='9' y1='0' x2='18.1' y2='13.6' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='31' y1='0' x2='21.9' y2='13.6' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='40' y1='9' x2='26.4' y2='18.1' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='40' y1='45' x2='26.4' y2='35.9' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='31' y1='54' x2='21.9' y2='40.4' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='9' y1='54' x2='18.1' y2='40.4' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='0' y1='45' x2='13.6' y2='35.9' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cline x1='0' y1='9' x2='13.6' y2='18.1' stroke='%23fff' stroke-opacity='0.35' stroke-width='1.2'/%3E%3Cpolygon points='13.95,7.2 26.05,7.2 32.8,13.95 32.8,40.05 26.05,46.8 13.95,46.8 7.2,40.05 7.2,13.95' fill='none' stroke='%23fff' stroke-opacity='0.3' stroke-width='1.2'/%3E%3Cpolygon points='18.1,13.6 21.9,13.6 26.4,18.1 26.4,35.9 21.9,40.4 18.1,40.4 13.6,35.9 13.6,18.1' fill='none' stroke='%23fff' stroke-opacity='0.45' stroke-width='1.2'/%3E%3Crect x='18.556' y='18.424' width='1.216' height='3.752' rx='1.876' fill='%23fff' fill-opacity='0.7'/%3E%3Cpolygon points='9,0 31,0 40,9 40,45 31,54 9,54 0,45 0,9' fill='none' stroke='%23c9a24b' stroke-width='2.4' stroke-linejoin='round'/%3E%3C/svg%3E");
    }
    .bar { display: grid; grid-template-columns: repeat(21, minmax(0, 1fr)); gap: 2px; }
    .bar button {
      padding: var(--space-1) 0;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }
    .bar button.mine { border-block-end: 2px solid var(--color-success); }
    .bar button.theirs { border-block-end: 2px solid var(--color-danger); }
    .bar button.active { border-color: var(--color-primary); background: var(--color-primary); color: var(--color-on-primary); font-weight: var(--font-weight-bold); }

    .compact { display: none; }

    /* On every screen: the value and the two bars (the radio group above stays for screen readers) */
    @media all {
      .bar {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      .compact {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: var(--space-2);
      }
      // Each side: slanted steps that light up from the middle outwards, fainter towards the edge of the table
      .side {
        display: flex;
        gap: 3px;
        block-size: 0.5rem;
      }
      .side.mine {
        flex-direction: row-reverse;
        mask-image: linear-gradient(to left, #000 60%, rgb(0 0 0 / 45%));
      }
      .side.theirs { mask-image: linear-gradient(to right, #000 60%, rgb(0 0 0 / 45%)); }
      // Mirrored: each side's steps lean towards the middle
      .side.theirs .step { transform: skewX(24deg); }
      .step {
        flex: 1;
        padding: 0;
        border: 0;
        border-radius: 2px;
        background: color-mix(in srgb, var(--color-text) 16%, transparent);
        transform: skewX(-24deg);
        transition: background var(--duration-fast, 120ms) ease, box-shadow var(--duration-fast, 120ms) ease;
        cursor: pointer;
      }
      .side.mine .step.lit {
        background: linear-gradient(90deg, var(--color-success), color-mix(in srgb, var(--color-success) 70%, white));
        box-shadow: 0 0 6px color-mix(in srgb, var(--color-success) 70%, transparent);
      }
      .side.theirs .step.lit {
        background: linear-gradient(90deg, color-mix(in srgb, var(--color-danger) 70%, white), var(--color-danger));
        box-shadow: 0 0 6px color-mix(in srgb, var(--color-danger) 70%, transparent);
      }
      // The value in a cut gem: its color is the side the gems are on (none in the middle)
      .value {
        position: relative;
        display: grid;
        place-items: center;
        inline-size: 2rem;
        block-size: 2rem;
        padding: 0;
        border: 0;
        background: none;
        color: var(--color-text-muted);
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-bold);
        font-variant-numeric: tabular-nums;
        cursor: pointer;
      }
      .value::before {
        position: absolute;
        inset: 0.3rem;
        z-index: -1;
        border: 1.5px solid currentColor;
        border-radius: 4px;
        background: color-mix(in srgb, currentColor 14%, var(--color-surface));
        box-shadow: 0 0 10px color-mix(in srgb, currentColor 40%, transparent);
        transform: rotate(45deg);
        content: '';
      }
      .value.mine { color: var(--color-success); }
      .value.theirs { color: var(--color-danger); }
      .compact { isolation: isolate; }
    }

    /* "Estilo de la mesa: arcano" (the table sets --arcane-*): a channel cut in the stone with faceted gems, the value
       in a big cut gem ringed in gold; on wide screens, the positions are engraved tiles */
    :host-context(.arcane) .bar button {
      border-color: var(--arcane-gold-soft);
      background: linear-gradient(180deg, #23272f, #15181d);
      color: #b9b2a2;
      font-family: var(--font-family-display);
    }
    :host-context(.arcane) .bar button.mine { border-block-end-color: var(--arcane-ally); }
    :host-context(.arcane) .bar button.theirs { border-block-end-color: var(--arcane-rival); }
    :host-context(.arcane) .bar button.active {
      border-color: var(--arcane-gold);
      background: radial-gradient(circle at 35% 30%, #fff8, transparent 40%), var(--arcane-ally);
      box-shadow: 0 0 0 1px var(--arcane-gold), 0 0 12px color-mix(in srgb, var(--arcane-ally) 60%, transparent);
      color: #fff;
    }
    :host-context(.arcane) .bar button.active.theirs {
      background: radial-gradient(circle at 35% 30%, #fff8, transparent 40%), var(--arcane-rival);
      box-shadow: 0 0 0 1px var(--arcane-gold), 0 0 12px color-mix(in srgb, var(--arcane-rival) 60%, transparent);
    }
    @media all {
      :host-context(.arcane) .side {
        align-items: center;
        gap: 2px;
        block-size: 0.9rem;
        padding: 0 0.35rem;
        border-radius: 0.5rem;
        background: linear-gradient(180deg, var(--arcane-stone-dark), #1a1d23);
        box-shadow: inset 0 2px 4px rgb(0 0 0 / 80%), 0 1px 0 rgb(255 255 255 / 6%), 0 0 0 1px var(--arcane-gold-soft);
        mask-image: none;
      }
      :host-context(.arcane) .step {
        aspect-ratio: 1;
        block-size: auto;
        max-block-size: 0.7rem;
        border: 0;
        border-radius: 0;
        /* A dull emerald cut */
        background: var(--bar-gem-off) center / 100% 100% no-repeat;
        box-shadow: none;
        transform: rotate(-45deg);
      }
      // Mirrored: each side's gems lean towards the middle
      :host-context(.arcane) .side.theirs .step { transform: rotate(45deg); }
      /* Lit: a cut gem of the side's color — the shine along its ridge, the light facet above, the dark one below */
      :host-context(.arcane) .side.mine .step.lit {
        background: var(--bar-gem-green) center / 100% 100% no-repeat;
        box-shadow: none;
        filter: drop-shadow(0 0 4px var(--arcane-ally));
      }
      :host-context(.arcane) .side.theirs .step.lit {
        background: var(--bar-gem-red) center / 100% 100% no-repeat;
        box-shadow: none;
        filter: drop-shadow(0 0 4px var(--arcane-rival));
      }
      :host-context(.arcane) .value {
        inline-size: 2.4rem;
        block-size: 2.4rem;
        color: #fff;
        font-family: var(--font-family-display);
        text-shadow: 0 1px 2px rgb(0 0 0 / 60%);
      }
      /* The value in a big upright emerald cut, edged in gold; it glows in its side's color */
      :host-context(.arcane) .value::before {
        inset: 0 13%;
        border: 0;
        border-radius: 0;
        background: var(--big-gem-off) center / 100% 100% no-repeat;
        box-shadow: none;
        filter: drop-shadow(0 3px 5px rgb(0 0 0 / 60%));
        transform: none;
      }
      :host-context(.arcane) .value.mine::before {
        background: var(--big-gem-green) center / 100% 100% no-repeat;
        box-shadow: none;
        filter: drop-shadow(0 0 8px color-mix(in srgb, var(--arcane-ally) 70%, transparent));
      }
      :host-context(.arcane) .value.theirs::before {
        background: var(--big-gem-red) center / 100% 100% no-repeat;
        box-shadow: none;
        filter: drop-shadow(0 0 8px color-mix(in srgb, var(--arcane-rival) 70%, transparent));
      }
    }

    /* Wide screens: the phone's marker, across the whole width — each bar fills its side (its steps grow sideways),
       a little taller, the gem in the middle bigger */
    @media not all and (orientation: landscape) and (max-height: 30rem) {
      .compact { gap: var(--space-3); }
      .side { gap: 6px; block-size: 1.1rem; }
      .value { inline-size: 3.25rem; block-size: 3.25rem; font-size: 1.35rem; }
      .value::before { inset: 0.5rem; border-width: 2px; }
      :host-context(.arcane) .side { gap: 6px; block-size: 1.9rem; padding: 0 0.75rem; border-radius: 0.8rem; }
      /* Thick bars (thin ones look frail across a wide screen) */
      :host-context(.arcane) .step { max-block-size: 1.5rem; }
      :host-context(.arcane) .value { inline-size: 3.75rem; block-size: 3.75rem; font-size: 1.35rem; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedBarComponent {
  readonly index = input.required<number>();
  readonly positionSelected = output<number>();
  protected readonly labels = LABELS;
  protected readonly mine = MINE;
  protected readonly theirs = THEIRS;
  /** The number at the marker (0 in the middle, up to 10 on either side). */
  protected readonly value = computed(() => LABELS[this.index()] ?? 0);
}
