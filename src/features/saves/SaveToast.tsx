import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';

// Styles: src/components/reader-library.css (global; this appears on prerendered pages).

/**
 * A short confirmation with one way onward: "已收藏 · 查看" / "已加入 10/10 计划 · 查看". Saves and plans confirm here
 * until the app toast takes an action (WEB-SHELL1); then this can hand the same two strings to it.
 * Polite live region, 44px targets, closes itself after 6 s, nothing animates under reduced motion.
 */
export function SaveToast({ message, actionLabel, to, closeLabel, onClose }: { message: string; actionLabel: string; to: string; closeLabel: string; onClose: () => void }) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const timer = window.setTimeout(() => close.current(), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="saves-toast" role="status" aria-live="polite" data-testid="save-toast">
    <Check aria-hidden="true" strokeWidth={2} />
    <span className="saves-toast__message">{message}</span>
    <Link className="saves-toast__action" to={to} onClick={() => close.current()}>{actionLabel}</Link>
    <button type="button" className="saves-toast__close" aria-label={closeLabel} onClick={() => close.current()}><X aria-hidden="true" strokeWidth={1.75} /></button>
  </div>, document.body);
}
