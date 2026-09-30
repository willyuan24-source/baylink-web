/**
 * W7-Q6 · iOS touch guards for the full-screen game (installed by OpusBayPage with the html.ob-lock class; page chunk,
 * dependency-free):
 *
 *   gesturestart / gesturechange   preventDefault (WebKit's pinch events): iOS ignores user-scalable=no, and inside an
 *                                  overflow scroller (旅行本, the shop, the map list) a pinch zoomed the whole fixed game
 *                                  with no way to scroll it back
 *   a leftover page scroll         the map search opens the iOS keyboard and iOS scrolls the layout viewport to show the
 *                                  input; with html overflow hidden nothing can scroll it back, so the canvas and the HUD
 *                                  stayed shifted up. After an input loses focus (focusout), and when the visual viewport
 *                                  grows back while nothing is being typed in, the page is scrolled back to 0, 0.
 */

interface TouchWindow {
  scrollX?: number;
  scrollY?: number;
  scrollTo(x: number, y: number): void;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  visualViewport?: { offsetTop?: number; addEventListener(type: string, fn: () => void): void; removeEventListener(type: string, fn: () => void): void } | null;
  addEventListener?(type: string, fn: (e: Event) => void, o?: AddEventListenerOptions | boolean): void;
}
interface TouchDocument {
  activeElement?: Element | null;
  documentElement?: { scrollTop?: number };
  addEventListener(type: string, fn: (e: Event) => void, o?: AddEventListenerOptions | boolean): void;
  removeEventListener(type: string, fn: (e: Event) => void, o?: AddEventListenerOptions | boolean): void;
}

const typing = (el: Element | null | undefined) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable === true);

/** Is the page scrolled off 0, 0 (window or the visual viewport)? */
export const pageShifted = (win: TouchWindow, doc: TouchDocument) =>
  !!(win.scrollY || win.scrollX || doc.documentElement?.scrollTop || win.visualViewport?.offsetTop);

/** Install the guards; returns the disposer. */
export function installIosTouchGuards(win: TouchWindow = window as unknown as TouchWindow, doc: TouchDocument = document as unknown as TouchDocument): () => void {
  const noZoom = (e: Event) => { e.preventDefault(); };
  const opts: AddEventListenerOptions = { passive: false };
  doc.addEventListener('gesturestart', noZoom, opts);
  doc.addEventListener('gesturechange', noZoom, opts);
  let timer = 0;
  const settle = () => {
    win.clearTimeout(timer);
    // after the keyboard has begun to close (iOS moves the viewport back on its own sometimes: then nothing to do)
    timer = win.setTimeout(() => { if (!typing(doc.activeElement) && pageShifted(win, doc)) win.scrollTo(0, 0); }, 120);
  };
  const onFocusOut = () => settle();
  doc.addEventListener('focusout', onFocusOut);
  const vv = win.visualViewport;
  const onViewport = () => { if (!typing(doc.activeElement)) settle(); };
  vv?.addEventListener('resize', onViewport);
  return () => {
    doc.removeEventListener('gesturestart', noZoom, opts);
    doc.removeEventListener('gesturechange', noZoom, opts);
    doc.removeEventListener('focusout', onFocusOut);
    vv?.removeEventListener('resize', onViewport);
    win.clearTimeout(timer);
  };
}
