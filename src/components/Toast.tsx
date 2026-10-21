// Toast: one message at a time, with an optional action ("收到新私信 · 查看"). Styles: site-chrome.css.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { useLocale } from '../i18n/locale';

/** A toast about a thing can open it: "收到新私信 · 查看" → the thread (G1). */
export type ToastAction = { label: string; onClick: () => void };
export type ToastType = 'success' | 'error' | 'info';

/** Notices close after 6 s; errors stay a little longer (8 s) instead of sticking until dismissed (E2E-08). */
const TOAST_DURATION_MS: Record<ToastType, number> = { success: 6000, info: 6000, error: 8000 };
/** The exit (site-chrome.css site-toast-out, --dur-2): the toast stays this long after it is dismissed. */
export const TOAST_EXIT_MS = 160;
const instant = () => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-simple');

export const Toast = ({ message, type, action, onClose }: { message: string, type: ToastType, action?: ToastAction, onClose: () => void }) => {
  // Unrelated rerenders must not restart the timer.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  // N24: a dismissed toast leaves (fades and drops 8px over --dur-2) before it unmounts; at once under reduced motion and
  // in 简洁显示, where every duration is 0.
  const [leaving, setLeaving] = useState(false);
  const leave = useRef<number | undefined>(undefined);
  const dismiss = () => {
    if (leave.current !== undefined) return;
    if (instant()) { onCloseRef.current(); return; }
    setLeaving(true);
    leave.current = window.setTimeout(() => onCloseRef.current(), TOAST_EXIT_MS);
  };
  useEffect(() => () => window.clearTimeout(leave.current), []);
  // A pointer over the toast or focus inside it holds the timer, so the reader can still reach its buttons.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const t = setTimeout(dismiss, TOAST_DURATION_MS[type]);
    return () => clearTimeout(t);
  }, [message, type, held]);
  const english = useLocale() === 'en';
  // G90 (CW-07): the toast lives beside #root, not inside it. A sheet or dialog makes #root inert (ui/Modal.tsx), which
  // would leave a toast raised meanwhile (a dialog's error, "收到新私信 · 查看") untappable and unannounced; its z-index
  // (site-chrome.css) keeps it above the dialog.
  return createPortal(
    // design.md §4.5: at the bottom, above the tab bar on phones (site-chrome.css), so it never covers the header's ••• or
    // search; ink background, white text. The outer box places it, the inner one is the toast.
    <div className="site-toast">
      <div
        role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'}
        className="site-toast-box" data-type={type} data-leaving={leaving ? '' : undefined}
        onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false); }}
      >
        {type === 'success' ? <CheckCircle size={20} aria-hidden="true" strokeWidth={1.75} /> : <AlertCircle size={20} aria-hidden="true" strokeWidth={1.75} />}
        <span className="site-toast-message">{message}</span>
        {action && <button type="button" className="site-toast-action" onClick={() => { action.onClick(); onCloseRef.current(); }}>{action.label}</button>}
        <button type="button" aria-label={english ? 'Close' : '关闭提示'} className="site-toast-close" onClick={dismiss}><X size={20} aria-hidden="true" strokeWidth={1.75} /></button>
      </div>
    </div>,
    document.body,
  );
};
