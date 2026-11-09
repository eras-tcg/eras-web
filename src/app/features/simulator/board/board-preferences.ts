import { Injectable, computed, signal } from '@angular/core';
import { persistedFlag } from '@core/storage/persisted-flag';
import { persistedNumber } from '@core/storage/persisted-number';

/** "Mesa en perspectiva" at the end of its slider: how far the table leans back, in degrees. */
const TABLE_TILT_MAX = 24;

/**
 * The table's preferences, remembered on the device (the options sidebar sets them), and the sidebar's own state.
 * Provided by the board page: its components read them from here.
 */
@Injectable()
export class BoardPreferences {
  /** "Zonas espejadas": the rival's lives and gems swap with their piles. */
  readonly mirrored = persistedFlag('eras-sim-mirrored');
  /** How much the table's zones show: 0 all (filled and outlined), 1 only their outlines, 2 only the line between the field's lines. */
  readonly zoneLook = persistedNumber('eras-sim-zones', 0, 0, 2);
  readonly zoneLookNames = ['total', 'suave', 'nula'];
  /** "Estilo de la mesa": 0 limpio (plain surfaces), 1 arcano (dark stone, engraved zones, gold, cut gems). */
  readonly tableStyle = persistedNumber('eras-sim-style', 1, 0, 1);
  readonly tableStyleNames = ['limpio', 'arcano'];
  readonly arcane = computed(() => this.tableStyle() === 1);
  /** "Mano recta": the hands in a row instead of a fan. */
  readonly straightHand = persistedFlag('eras-sim-straight-hand');
  /** "Altura de la mano": how much higher your hand stands over the table's edge, from low (0) to high (1). */
  readonly handLift = persistedNumber('eras-sim-hand-lift', 0.4, 0, 1);
  /**
   * "Mesa en perspectiva": how far the table leans back, as seen from your seat (not on phones), from flat (0) to
   * TABLE_TILT_MAX (1). Only a slider, no number.
   */
  readonly tilt = persistedNumber('eras-sim-tilt', 0, 0, 1);
  readonly tilted = computed(() => this.tilt() > 0);
  readonly tiltAngle = computed(() => `${this.tilt() * TABLE_TILT_MAX}deg`);
  /** The latest actions shown as notices over the table (top left). */
  readonly noticesOff = persistedFlag('eras-sim-notices-off');

  /** The options sidebar: expanded (names beside the icons), or dynamic (it expands while the pointer is on it). */
  readonly sidebarExpanded = persistedFlag('eras-sim-sidebar-expanded');
  readonly sidebarDynamic = persistedFlag('eras-sim-sidebar-dynamic');
  readonly sidebarHover = signal(false);
  readonly sidebarOpen = computed(() => (this.sidebarDynamic() ? this.sidebarHover() : this.sidebarExpanded()));

  toggleSidebar(): void {
    this.sidebarExpanded.update((on) => !on);
    // Collapsing it by hand leaves it collapsed until hovered again
    if (!this.sidebarExpanded()) this.sidebarHover.set(false);
  }
}
