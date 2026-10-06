import { recordProductEvent } from './product-events';
/** Coarse action counters only: no query text, destination URL, identifier or visitor fingerprint. */
export function installProductObserver() {
  if (typeof document === 'undefined') return;
  const from = new URLSearchParams(location.search).get('from') || '';
  if (/^card-[a-z0-9-]{1,40}$/.test(from)) recordProductEvent('site_arrival_from_card');
  else if (/^(opus|opus-bay|opus-return|opus-place|opus-postcard)$/.test(from)) recordProductEvent('site_arrival_from_opus');
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('a,button') : null;
    if (!target) return;
    if (target.closest('.site-nav,.site-mobile-nav,.site-secondary-nav')) recordProductEvent('nav_click');
    if (target.closest('.home-discovery') && !target.closest('form')) recordProductEvent('home_module_click');
    if (target.closest('[data-contact-action],.post-detail__quick-contact,.post-card__contact')) recordProductEvent('contact_click');
  });
  // Aggregate failures; error objects can contain personal data and never leave this browser.
  window.addEventListener('error', () => recordProductEvent('client_error'));
}
