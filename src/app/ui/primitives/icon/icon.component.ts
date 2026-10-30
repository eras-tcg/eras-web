import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** 24x24 stroke icons. To change the icon set, change only this file. */
const ICONS = {
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  user: 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  logout: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h12',
  box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  menu: 'M4 6h16M4 12h16M4 18h16',
  external: 'M14 4h6v6M10 14L20 4M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6',
  cards: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  'sort-asc': 'M4 6h7M4 12h5M4 18h3M17 20V4m0 0-3 3m3-3 3 3',
  'sort-desc': 'M4 6h3M4 12h5M4 18h7M17 4v16m0 0-3-3m3 3 3-3',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  layers: 'M12 3 2 8l10 5 10-5-10-5zM2 12.5l10 5 10-5M2 17l10 5 10-5',
  'square-plus': 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 8v8M8 12h8',
  stack: 'M8 3h11a2 2 0 0 1 2 2v11M5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  gamepad: 'M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-4 3.6l-.7 6.3A3 3 0 0 0 5 18c1 0 1.5-.5 2-1l1.4-1.4a2 2 0 0 1 1.4-.6h4.4a2 2 0 0 1 1.4.6L17 17c.5.5 1 1 2 1a3 3 0 0 0 3-3.1l-.7-6.3a4 4 0 0 0-4-3.6z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  check: 'M20 6 9 17l-5-5',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  key: 'M15 7a4 4 0 1 1-3.9 4.9L3 20v-3h2v-2h2l2.1-2.1A4 4 0 0 1 15 7zM16 10h.01',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  sword: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2',
  play: 'M6 4l14 8-14 8V4z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  maximize: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  skull: 'M12 2a8 8 0 0 0-8 8c0 3 1.6 5.2 4 6.3V20h8v-3.7c2.4-1.1 4-3.3 4-6.3a8 8 0 0 0-8-8zM9 11h.01M15 11h.01M10 20v-2M14 20v-2',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  draw: 'M12 3v12m0 0-4-4m4 4 4-4M5 21h14',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  'check-circle': 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z',
  gem: 'M6 3h12l4 6-10 12L2 9zM2 9h20',
  'trending-down': 'M22 17l-8.5-8.5-5 5L2 7M16 17h6v-6',
  hand: 'M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-3a2 2 0 0 0-4 0',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  swap: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  // Card types: three claw marks (Criatura), a flask (Utilidad), a tower (Estructura)
  creature: 'M6 3c2 5 2 11-1 18M12 2c2 6 2 13-1 20M18 3c2 5 2 11-1 18',
  utility: 'M9 3h6M10 3v5.5L4.6 18.2A2 2 0 0 0 6.4 21h11.2a2 2 0 0 0 1.8-2.8L14 8.5V3M7 15h10',
  structure: 'M4 21h16M5 21V9h3V5h2v2h4V5h2v4h3v12M10 21v-5a2 2 0 0 1 4 0v5M9 12h.01M15 12h.01',
} as const;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'eras-icon',
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path [attr.d]="path()" />
    </svg>
  `,
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  protected readonly path = computed(() => ICONS[this.name()]);
}
