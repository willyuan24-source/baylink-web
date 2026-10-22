// Toast: one message at a time, with an optional action ("收到新私信 · 查看") or link ("已收藏 · 查看"). The site's one toast
// (N24): saves and plans confirm through it too (features/saves/SaveToast.tsx). Styles: site-chrome.css.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { useLocale } from '../i18n/locale';
import { useClosing } from './ui/Modal';

/** A toast about a thing can open it: "收到新私信 · 查看" → the thread (G1). */
export type ToastAction = { label: string; onClick: () => void };
export type ToastType = 'success' | 'error' | 'info';

/** Notices close after 6 s; errors stay a little longer (8 s) instead of sticking until dismissed (E2E-08). */
const TOAST_DURATION_MS: Record<ToastType, number> = { success: 6000, info: 6000, error: 8000 };
/** The exit (site-chrome.css site-toast-out, --dur-2): the toast stays this long after it is dismissed. */
export const TOAST_EXIT_MS = 160;

export type ToastProps = {
  message: string;
  type: ToastType;
  action?: ToastAction;
  /** A router link as the action ("已收藏 · 查看" → /my-week#saved); following it closes the toast. */
  link?: { label: string; to: string };
  /** The ✕'s name: 关闭提示 / Close by default. */
  closeLabel?: string;
  /** The caller announces the message itself (SaveToast's polite announcer), so the box is not a second live region. */
  quiet?: boolean;
  testId?: string;
  onClose: () => void;
};

export const Toast = ({ message, type, action, link, closeLabel, quiet, testId, onClose }: ToastProps) => {
  // N24: a dismissed toast leaves (fades and drops 8px over --dur-2) before it unmounts; at once under reduced motion and
  // in 简洁显示, where every duration is 0 (useClosing, ui/Modal.tsx). Unrelated rerenders do not restart the timer.
  const [leaving, dismiss] = useClosing(onClose, TOAST_EXIT_MS);
  // A pointer over the toast or focus inside it holds the timer, so the reader can still reach its buttons.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const t = setTimeout(dismiss, TOAST_DURATION_MS[type]);
    return () => clearTimeout(t);
  }, [message, type, held]);
  const english = useLocale() === 'en';
  const close = closeLabel ?? (english ? 'Close' : '关闭提示');
  const live = quiet ? undefined : type === 'error' ? 'assertive' : 'polite';
  // G90 (CW-07): the toast lives beside #root, not inside it. A sheet or dialog makes #root inert (ui/Modal.tsx), which
  // would leave a toast raised meanwhile (a dialog's error, "收到新私信 · 查看") untappable and unannounced; its z-index
  // (site-chrome.css) keeps it above the dialog.
  return createPortal(
    // design.md §4.5: at the bottom, above the tab bar on phones (site-chrome.css), so it never covers the header's ••• or
    // search; ink background, white text. The outer box places it, the inner one is the toast.
    <div className="site-toast" data-testid={testId}>
      <div
        role={live && (type === 'error' ? 'alert' : 'status')} aria-live={live}
        className="site-toast-box" data-type={type} data-leaving={leaving ? '' : undefined}
        onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false); }}
      >
        {type === 'success' ? <CheckCircle size={20} aria-hidden="true" strokeWidth={1.75} /> : <AlertCircle size={20} aria-hidden="true" strokeWidth={1.75} />}
        <span className="site-toast-message">{message}</span>
        {action && <button type="button" className="site-toast-action" onClick={() => { action.onClick(); onClose(); }}>{action.label}</button>}
        {link && <Link className="site-toast-action" to={link.to} onClick={() => onClose()}>{link.label}</Link>}
        {/* N13: the one close button (ui/CloseButton.tsx: the icon button's 44px circle, ✕ at 1.75), written out here so the
            shell does not load Button.tsx and its sheets for it. */}
        <button type="button" className="ui-icon-button ui-close" aria-label={close} title={close} onClick={dismiss}><X aria-hidden="true" strokeWidth={1.75} /></button>
      </div>
    </div>,
    document.body,
  );
};
