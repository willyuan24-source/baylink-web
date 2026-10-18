import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { announce } from './save-announcer';

// Styles: the app toast's (src/components/site-chrome.css, global): one toast look site-wide (UI9-F).

/**
 * A short confirmation with one way onward: "已收藏 · 查看" / "已加入 10/10 计划 · 查看". Saves and plans confirm here
 * with the app toast's look and place (components/Toast.tsx); this keeps only its own lifecycle: a router link as the
 * action, one at a time, and the polite announcer instead of a live role.
 * 44px targets, closes itself after 6 s, nothing animates under reduced motion. Screen readers hear the message from
 * one polite live region that is already in the page, empty, when the message arrives (`save-announcer.ts`).
 * One at a time: every control renders its own toast in the same spot, so a new one closes the one shown before.
 */
let closeShown: (() => void) | null = null;

export function SaveToast({ message, actionLabel, to, closeLabel, onClose }: { message: string; actionLabel: string; to: string; closeLabel: string; onClose: () => void }) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const mine = () => close.current();
    const previous = closeShown;
    closeShown = mine;
    previous?.();
    const timer = window.setTimeout(mine, 6000);
    const quiet = announce(message);
    return () => { window.clearTimeout(timer); quiet(); if (closeShown === mine) closeShown = null; };
  }, [message]);
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="site-toast" data-testid="save-toast">
    <div className="site-toast-box" data-type="success">
      <Check size={20} aria-hidden="true" />
      <span className="site-toast-message">{message}</span>
      <Link className="site-toast-action" to={to} onClick={() => close.current()}>{actionLabel}</Link>
      <button type="button" className="site-toast-close" aria-label={closeLabel} onClick={() => close.current()}><X size={20} aria-hidden="true" /></button>
    </div>
  </div>, document.body);
}
