import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';
import { navDirection } from './screens';

/** URL path of a router state, from its root snapshot down the active branch. */
function pathOf(root: ActivatedRouteSnapshot): string {
  const segments: string[] = [];
  for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
    segments.push(...route.url.map((s) => s.path));
  }
  return '/' + segments.filter(Boolean).join('/');
}

/**
 * Screen changes animate with the browser's view transitions: the page tells the CSS which way it goes
 * (`html[data-nav]`: deeper slides in from the right, back from the left; see styles/base/_transitions.scss).
 */
export function onScreenTransition({ transition, from, to }: ViewTransitionInfo): void {
  const html = document.documentElement;
  html.dataset['nav'] = navDirection(pathOf(from), pathOf(to));
  void transition.finished.finally(() => delete html.dataset['nav']);
}
