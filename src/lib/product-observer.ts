import { recordIcsDownload, recordProductEvent } from './product-events';
import { reportClientError } from './client-errors';
import { matchRoute } from '../app/route-table';
import { bootTesterMode } from '../features/feedback/tester-mode';

/** A calendar file or subscription link: `download="….ics"` (the generated files), an .ics URL or webcal:. */
const isCalendarLink = (link: Element) => /\.ics$/i.test(link.getAttribute('download') || '')
  || /^webcal:|\.ics(?:$|[?#])/i.test(link.getAttribute('href') || '');

/** Coarse action counters only: no query text, destination URL, identifier or visitor fingerprint. */
export function installProductObserver() {
  if (typeof document === 'undefined') return;
  const from = new URLSearchParams(window.location.search).get('from') || '';
  if (/^card-[a-z0-9-]{1,40}$/.test(from)) recordProductEvent('site_arrival_from_card');
  else if (/^(opus|opus-bay|opus-return|opus-place|opus-postcard)$/.test(from)) recordProductEvent('site_arrival_from_opus');
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('a,button') : null;
    if (!target) return;
    if (target.closest('.site-nav,.site-mobile-nav,.site-secondary-nav')) recordProductEvent('nav_click');
    if (target.closest('.home-discovery') && !target.closest('form')) recordProductEvent('home_module_click');
    if (target.closest('[data-contact-action],.post-detail__quick-contact,.post-card__contact')) recordProductEvent('contact_click');
    // Every calendar download goes through an <a download="….ics">, including the ones the page creates and clicks.
    if (target.tagName === 'A' && isCalendarLink(target)) recordIcsDownload();
  });
  // Error beacons (client-errors.ts): a fingerprint of the error, never its text. Render errors come from ErrorBoundary.
  window.addEventListener('error', event => reportClientError('error', event.error ?? event.message));
  window.addEventListener('unhandledrejection', event => reportClientError('rejection', event.reason));
  window.addEventListener('vite:preloadError', event => reportClientError('chunk', (event as Event & { payload?: unknown }).payload ?? 'preload'));
  bootTesterMode(!!matchRoute(window.location.pathname)?.bare);
}
