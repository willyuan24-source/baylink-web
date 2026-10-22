/** The card press at pointerdown (cards.css draws [data-press]); a side-effect module that Card.tsx and HeroCard.tsx import. */
const CARD = '.ui-feed-card,.ui-row-card,.ui-hero-card';
/** A touch shows its press after this long unless the browser takes it for a scroll first (pointercancel), so a swipe over a
 *  list does not flash every card it starts on; a tap shorter than this still shows the press as it ends. */
const TOUCH_PRESS_DELAY = 50;
let pressInstalled = false;
/**
 * Card press at pointerdown (N24, J3 P25: a touch is answered within 100 ms, not when :active arrives at release): one
 * delegated listener marks the card whose stretched link is pressed with [data-press] (cards.css draws the press) — at once
 * for a mouse, after TOUCH_PRESS_DELAY for a touch — and clears it on pointerup / cancel / a scroll. Installed once, by the
 * first card module that loads in a browser; the prerender (no document) skips it.
 */
function listenForCardPress() {
  if (pressInstalled || typeof document === 'undefined') return;
  pressInstalled = true;
  let pressed: Element | null = null, pending: Element | null = null, timer = 0;
  const mark = (card: Element) => { pending = null; pressed = card; card.setAttribute('data-press', ''); };
  const clear = () => { window.clearTimeout(timer); pending = null; pressed?.removeAttribute('data-press'); pressed = null; };
  document.addEventListener('pointerdown', event => {
    clear();
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const card = (event.target as Element | null)?.closest?.('.ui-card-link')?.closest(CARD);
    if (!card) return;
    if (event.pointerType === 'mouse') { mark(card); return; }
    pending = card;
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
listenForCardPress();
