import { ApplicationRef } from '@angular/core';

/**
 * Changes what a dialog shows as one view turning into the next: `change` runs and is rendered at once, and the
 * dialog's frame (`frame`, its eras-modal) goes from its old width and height to the new ones while its body fades
 * in. Only the frame moves: the page and the backdrop behind it stay as they are. Without animations (or when the
 * device asks for less motion) it just changes.
 */
export function morphView(appRef: ApplicationRef, frame: HTMLElement | null, change: () => void): void {
  const reduced = typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!frame || reduced || typeof frame.animate !== 'function') {
    change();
    return;
  }
  const before = frame.getBoundingClientRect();
  change();
  appRef.tick();
  const after = frame.getBoundingClientRect();
  const easing = getComputedStyle(frame).getPropertyValue('--easing-standard').trim() || 'ease';
  const timing: KeyframeAnimationOptions = { duration: 320, easing };
  if (Math.abs(before.width - after.width) > 1 || Math.abs(before.height - after.height) > 1) {
    frame.animate(
      [
        { inlineSize: `${before.width}px`, blockSize: `${before.height}px` },
        { inlineSize: `${after.width}px`, blockSize: `${after.height}px` },
      ],
      timing,
    );
  }
  frame.querySelector('.body')?.animate([{ opacity: 0 }, { opacity: 1 }], timing);
}
