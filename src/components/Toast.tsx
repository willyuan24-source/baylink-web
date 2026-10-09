// ✨ Toast 组件
import { useEffect, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

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
  const styles = type === 'success'
    ? 'toast-success shadow-card'
    : type === 'error'
    ? 'toast-error shadow-card'
    : 'bg-white text-baylink-text border-baylink-border/60 shadow-card';
  const iconColor = type === 'success' ? 'text-[#2d6b4f]' : type === 'error' ? 'text-[#B4534B]' : 'text-baylink-muted';
  return (
    // 外层负责定位（flex 居中 + 状态栏 safe-area 偏移），内层负责入场动画：
    // tailwindcss-animate 的 enter 关键帧会整体覆盖 transform，不能和 -translate-x-1/2 同元素共存
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+16px)] z-[10000] flex justify-center px-4">
      <div
        role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'}
        className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl border animate-in slide-in-from-top-5 fade-in duration-300 max-w-[90vw] ${styles}`}
        onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false); }}
      >
        <span className={iconColor}>{type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}</span>
        <span className="text-sm font-semibold">{message}</span>
        {action && <button type="button" className="site-toast-action" onClick={() => { action.onClick(); onCloseRef.current(); }}>{action.label}</button>}
        <button type="button" aria-label="关闭提示" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" onClick={() => onCloseRef.current()}><X size={20} aria-hidden="true" /></button>
      </div>
    </div>
  );
};
