import React, { useState } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { AuthBrandHeader } from './AuthBrandHeader';

type ForgotPasswordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<{ message: string; devResetLink?: string }>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass = 'w-full rounded-2xl border border-black/[0.06] bg-white/90 p-3.5 text-sm font-medium text-baylink-text outline-none placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15';

export const ForgotPasswordModal = ({ isOpen, onClose, onSubmit }: ForgotPasswordModalProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [devResetLink, setDevResetLink] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    setLoading(true);
    try {
      const res = await onSubmit(trimmed);
      setSuccessMessage('如果这个邮箱已注册，我们会发送重设密码链接。请检查邮箱。');
      if (import.meta.env.DEV && res.devResetLink) {
        setDevResetLink(res.devResetLink);
      }
    } catch (err: any) {
      setError(err?.error || err?.message || '请求失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-6 backdrop-blur-md animate-in fade-in">
      <div className="relative max-h-[90vh] w-full max-w-xs overflow-y-auto rounded-[28px] border border-black/[0.04] bg-baylink-bg-alt/95 p-7 shadow-elevated backdrop-blur-xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full border border-black/[0.06] bg-white/90 p-2 text-baylink-muted transition hover:text-baylink-text">
          <X size={18} />
        </button>
        <AuthBrandHeader compact />
        <h2 className="mb-1 text-center text-base font-semibold text-baylink-text">忘记密码</h2>
        <p className="mb-5 text-center text-[11px] text-baylink-muted">输入注册邮箱，我们会发送重设链接</p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {successMessage ? (
          <div className="space-y-4">
            <p className="rounded-2xl border border-baylink-green/15 bg-baylink-green-light/60 p-4 text-sm leading-relaxed text-baylink-text">{successMessage}</p>
            {devResetLink && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-[11px] font-semibold text-amber-700">开发模式测试链接</p>
                <a href={devResetLink} className="break-all text-xs font-medium text-amber-900 underline">
                  {devResetLink}
                </a>
              </div>
            )}
            <button type="button" onClick={onClose} className="w-full rounded-2xl bg-baylink-green py-3.5 font-semibold text-white shadow-rest transition hover:bg-baylink-green-hover active:scale-[0.98]">
              关闭
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              required
              type="email"
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="注册邮箱"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-baylink-green py-3.5 font-semibold text-white shadow-rest transition hover:bg-baylink-green-hover active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  发送中...
                </span>
              ) : (
                '发送重设链接'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
