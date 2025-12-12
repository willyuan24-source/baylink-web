// src/components/Toast.tsx
import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // 3秒后自动消失
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgClass = type === 'success' ? 'bg-gray-900 text-white' : type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white';
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : CheckCircle;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-6 py-3.5 rounded-full shadow-2xl animate-in slide-in-from-top-5 fade-in duration-300 ${bgClass}`}>
      <Icon size={18} strokeWidth={2.5} />
      <span className="text-sm font-bold tracking-wide">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100 transition"><X size={16}/></button>
    </div>
  );
};

export default Toast;