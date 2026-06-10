import React, { useState } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';

type ForgotPasswordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<{ message: string; devResetLink?: string }>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-gray-900/80 p-6 backdrop-blur-md animate-in fade-in">
      <div className="relative max-h-[90vh] w-full max-w-xs overflow-y-auto rounded-[2.5rem] bg-[#FFF8F0] p-8 shadow-2xl">
        <div className="absolute left-0 top-0 h-2 w-full bg-gradient-to-r from-green-400 to-teal-500" />
        <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-full bg-white p-2 text-gray-400 transition hover:text-gray-900">
          <X size={18} />
        </button>
        <h2 className="mb-1 text-center text-2xl font-black text-gray-900">忘记密码</h2>
        <p className="mb-6 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">重设您的登录密码</p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {successMessage ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-green-50 p-4 text-sm leading-relaxed text-green-800">{successMessage}</p>
            {devResetLink && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-700">开发模式测试链接</p>
                <a href={devResetLink} className="break-all text-xs font-medium text-amber-900 underline">
                  {devResetLink}
                </a>
              </div>
            )}
            <button type="button" onClick={onClose} className="w-full rounded-2xl bg-gray-900 py-4 font-bold text-white shadow-lg transition hover:bg-gray-800 active:scale-95">
              关闭
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              required
              type="email"
              autoComplete="email"
              className="w-full rounded-2xl bg-white p-4 font-bold placeholder:font-normal placeholder:text-gray-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="注册邮箱"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gray-900 py-4 font-bold text-white shadow-lg transition hover:bg-gray-800 active:scale-95 disabled:opacity-60"
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
