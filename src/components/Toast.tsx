// Toast: one message at a time, with an optional action ("收到新私信 · 查看"). Styles: site-chrome.css.
import { useEffect, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { useLocale } from '../i18n/locale';

/** A toast about a thing can open it: "收到新私信 · 查看" → the thread (G1). */
export type ToastAction = { label: string; onClick: () => void };
export type ToastType = 'success' | 'error' | 'info';

/** Notices close after 6 s; errors stay a little longer (8 s) instead of sticking until dismissed (E2E-08). */
const TOAST_DURATION_MS: Record<ToastType, number> = { success: 6000, info: 6000, error: 8000 };

export const Toast = ({ message, type, action, onClose }: { message: string, type: ToastType, action?: ToastAction, onClose: () => void }) => {
  // Unrelated rerenders must not restart the timer.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  // A pointer over the toast or focus inside it holds the timer, so the reader can still reach its buttons.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const t = setTimeout(() => onCloseRef.current(), TOAST_DURATION_MS[type]);
    return () => clearTimeout(t);
  }, [message, type, held]);
  const english = useLocale() === 'en';
  return (
    // design.md §4.5: at the bottom, above the tab bar on phones (site-chrome.css), so it never covers the header's ••• or
    // search; ink background, white text. The outer box places it, the inner one is the toast.
    <div className="site-toast">
      <div
        role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'}
        className="site-toast-box" data-type={type}
        onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false); }}
      >
        {type === 'success' ? <CheckCircle size={20} aria-hidden="true" /> : <AlertCircle size={20} aria-hidden="true" />}
        <span className="site-toast-message">{message}</span>
        {action && <button type="button" className="site-toast-action" onClick={() => { action.onClick(); onCloseRef.current(); }}>{action.label}</button>}
        <button type="button" aria-label={english ? 'Close' : '关闭提示'} className="site-toast-close" onClick={() => onCloseRef.current()}><X size={20} aria-hidden="true" /></button>
      </div>
    </div>
  );
};
