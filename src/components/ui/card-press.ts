/** The press at pointerdown (cards.css and ui.css draw [data-press]); a side-effect module that Card.tsx imports dynamically
 *  once it has loaded (its own chunk, outside every route's static graph). */
const CARD = '.ui-feed-card,.ui-row-card,.ui-hero-card';
/** What else answers a press (N24): the buttons, chips, tabs (the /events view row), ♡ and in-page links. */
const CONTROL = '.ui-button,.ui-icon-button,.ui-chip,.ui-save,.ui-tabs__item,.ui-segmented__item,a[href]';
/** A touch shows its press after this long unless the browser takes it for a scroll first (pointercancel), so a swipe over a
 *  list does not flash every card it starts on; a tap shorter than this still shows the press as it ends. */
const TOUCH_PRESS_DELAY = 25;
let pressInstalled = false;
/**
 * The press at pointerdown (N24, J3 P25: a touch is answered within 100 ms, not when :active arrives at release): one
 * delegated listener marks what is pressed with [data-press] — the card whose stretched link it is, else the control or
 * link itself — at once for a mouse, after TOUCH_PRESS_DELAY for a touch, and clears it on pointerup / cancel / a scroll.
 * Installed once, the first time Card.tsx loads in a browser; the prerender (no document) skips it.
 */
function listenForPress() {
  if (pressInstalled || typeof document === 'undefined') return;
  pressInstalled = true;
  let pressed: Element | null = null, pending: Element | null = null, timer = 0;
  const mark = (target: Element) => { pending = null; pressed = target; target.setAttribute('data-press', ''); };
  const clear = () => { window.clearTimeout(timer); pending = null; pressed?.removeAttribute('data-press'); pressed = null; };
  document.addEventListener('pointerdown', event => {
    clear();
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const from = event.target as Element | null;
    const target = from?.closest?.('.ui-card-link')?.closest(CARD) ?? from?.closest?.(CONTROL);
    if (!target || target.matches(':disabled,[aria-disabled=true]')) return;
    if (event.pointerType === 'mouse') { mark(target); return; }
    pending = target;
    timer = window.setTimeout(() => { if (pending) mark(pending); }, TOUCH_PRESS_DELAY);
  }, { capture: true, passive: true });
  // A tap that ends before the delay still shows its press, for one short beat.
  document.addEventListener('pointerup', () => {
    const tapped = pending;
    clear();
    if (tapped) { mark(tapped); timer = window.setTimeout(clear, 120); }
  }, { capture: true, passive: true });
  for (const type of ['pointercancel', 'dragstart', 'scroll']) document.addEventListener(type, clear, { capture: true, passive: true });
  window.addEventListener('blur', clear);
}
listenForPress();
