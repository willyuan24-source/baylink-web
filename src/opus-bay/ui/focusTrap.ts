/**
 * W9-A · keyboard focus in the game's dialogs (review R§6 界面与交互 + tech/notes.md: "goals dialog aria-modal=true but Tab
 * leaves to HUD"; "map: Esc closes … focus returns to BODY not to Map btn"):
 *
 *   - Tab / Shift+Tab never leave the topmost open `[aria-modal="true"]` dialog (the goals step, the postcard card, the
 *     recaps, the album, BAYBAY's menus): they wrap inside it; a focus outside it comes back in on the next Tab.
 *   - A dialog (any `[role="dialog"]`: the sheets too) that took the focus from a keyboard-focused control gives it back to
 *     that control when it closes. Only a keyboard opener: after a mouse click the focus stays where the game had it (a
 *     focused button would take Space, the jump, away from a mouse player).
 *
 * The play layer installs it once (ui/Dialogue.tsx); `installFocusTrap` returns the remover. The DOM helpers are exported
 * for the tests.
 */

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]';
const SCOPE = '.ob-page';

export function shown(el: Element): boolean {
  const h = el as HTMLElement;
  if (h.closest?.('[inert]')) return false;
  if (typeof h.checkVisibility === 'function') return h.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  return !!(h.offsetWidth || h.offsetHeight || h.getClientRects?.().length);
}

/** The topmost (last in document order) shown aria-modal dialog of the game, or null. */
export function topModal(doc: Pick<Document, 'querySelectorAll'> = document): HTMLElement | null {
  const all = doc.querySelectorAll<HTMLElement>(`${SCOPE} [aria-modal="true"]`);
  for (let i = all.length - 1; i >= 0; i--) if (shown(all[i])) return all[i];
  return null;
}

/** The controls Tab visits inside `root`, in order. */
export function tabbables(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.tabIndex >= 0 && shown(el));
}

/** Where Tab goes inside `modal` from `active` (null: let the browser move it). */
export function trapTarget(modal: HTMLElement, active: Element | null, back: boolean): HTMLElement | null {
  const list = tabbables(modal);
  if (!list.length) return modal;
  const first = list[0], last = list[list.length - 1];
  if (!active || !modal.contains(active)) return back ? last : first;
  if (back && (active === first || active === modal)) return last;
  if (!back && active === last) return first;
  return null;
}

export function installFocusTrap(doc: Document = document): () => void {
  let keyboard = false;
  const openers = new Map<HTMLElement, HTMLElement>();
  let timer = 0;

  const onKey = (e: KeyboardEvent) => {
    keyboard = true;
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
    const modal = topModal(doc);
    if (!modal) return;
    const to = trapTarget(modal, doc.activeElement, e.shiftKey);
    if (!to) return;
    e.preventDefault();
    if (to === modal && modal.tabIndex < 0 && !modal.hasAttribute('tabindex')) modal.tabIndex = -1;
    to.focus({ preventScroll: true });
  };
  const onPointer = () => { keyboard = false; };
  const onFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    const from = e.relatedTarget as HTMLElement | null;
    const dlg = target?.closest?.<HTMLElement>('[role="dialog"]');
    if (!dlg || !from || dlg.contains(from) || openers.has(dlg) || !keyboard || !from.closest?.(SCOPE)) return;
    openers.set(dlg, from);
    if (!timer) timer = window.setInterval(restore, 250);
  };
  /** a dialog that closed gives the focus back (when nothing else took it) */
  function restore() {
    for (const [dlg, opener] of [...openers]) {
      if (dlg.isConnected && shown(dlg)) continue;
      openers.delete(dlg);
      const active = doc.activeElement;
      const lost = !active || active === doc.body || !active.isConnected;
      if (lost && opener.isConnected && shown(opener)) opener.focus({ preventScroll: true });
    }
    if (!openers.size && timer) { window.clearInterval(timer); timer = 0; }
  }

  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('pointerdown', onPointer, true);
  doc.addEventListener('focusin', onFocusIn, true);
  return () => {
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('pointerdown', onPointer, true);
    doc.removeEventListener('focusin', onFocusIn, true);
    if (timer) window.clearInterval(timer);
    openers.clear();
  };
}
