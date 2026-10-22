import { useEffect, useRef } from 'react';
import { Toast } from '../../components/Toast';
import { announce } from './save-announcer';

/**
 * A short confirmation with one way onward: "已收藏 · 查看" / "已加入 10/10 计划 · 查看". Saves and plans confirm on the
 * site's one toast (components/Toast.tsx: its look and place, its 6 s timer held under a pointer or focus, its exit; N24);
 * this keeps only what a save adds: a router link as the action, one at a time, and the polite announcer instead of a live
 * role. Screen readers hear the message from one polite live region that is already in the page, empty, when the message
 * arrives (`save-announcer.ts`). One at a time: every control renders its own toast in the same spot, so a new one closes
 * the one shown before.
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
    const quiet = announce(message);
    return () => { quiet(); if (closeShown === mine) closeShown = null; };
  }, [message]);
  if (typeof document === 'undefined') return null;
  return <Toast key={message} message={message} type="success" link={{ label: actionLabel, to }} closeLabel={closeLabel} quiet testId="save-toast" onClose={() => close.current()} />;
}
