import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The page arrival (G21, D3 route grammar): after an in-app navigation the new page fades in over --dur-3 (200ms) and
 * rises 4px on --ease-out. The header and the tab bar never move (they are outside <main>), and a page with its own
 * fixed action bar only fades, so the bar does not rise with it. Never on the first, prerendered paint (no LCP or CLS
 * cost), and not under reduced motion or in 简洁显示. The layout renders this inside its <Routes location={background}>,
 * so opening a post or profile over a page is not an arrival.
 */
export function RouteArrival(): null {
  const { pathname } = useLocation();
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-simple')) return;
    // The page's own boxes: <main> also holds the route bar, which must not fade.
    const pages = [...document.getElementById('scroll-container')?.children ?? []].filter((node): node is HTMLElement => node instanceof HTMLElement && !node.classList.contains('site-route-progress') && typeof node.animate === 'function');
    for (const page of pages) {
      const rise = !page.querySelector('.site-detail-actions');
      page.animate(rise ? [{ opacity: 0, translate: '0 4px' }, { opacity: 1, translate: '0 0' }] : [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }, [pathname]);
  return null;
}
