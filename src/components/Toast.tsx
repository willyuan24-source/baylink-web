// ✨ Toast 组件
import { useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

export const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  // 计时器只随内容变化重置：依赖 onClose（每次渲染都是新闭包）会导致任何无关重渲染都把 3 秒重新计时
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => { const t = setTimeout(() => onCloseRef.current(), 3000); return () => clearTimeout(t); }, [message, type]);
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
      <div role="status" aria-live="polite" className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl border animate-in slide-in-from-top-5 fade-in duration-300 max-w-[90vw] ${styles}`}>
        <span className={iconColor}>{type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}</span>
        <span className="text-sm font-semibold">{message}</span>
      </div>
    </div>
  );
};
