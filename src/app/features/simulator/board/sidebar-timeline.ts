import { computed } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';

/** The time line of a replay or the Sala de pruebas, as the sidebar shows it. */
export function sidebarTimeline(game: GameStore) {
  return {
    /** The move shown, as "12 / 30" (null without a time line). */
    label: computed(() => {
      const s = game.state();
      return s?.timelineSize ? `${(s.timelineAt ?? 0) + 1} / ${s.timelineSize}` : null;
    }),
    /** Going back shows the past: "al presente" brings the last move back. */
    inThePast: computed(() => {
      const s = game.state();
      return !!s?.timelineSize && (s.timelineAt ?? 0) < s.timelineSize - 1;
    }),
    /** Back to the last move. */
    toPresent: () => {
      const size = game.state()?.timelineSize ?? 0;
      if (size) game.timeStep({ to: size - 1 });
    },
  };
}
