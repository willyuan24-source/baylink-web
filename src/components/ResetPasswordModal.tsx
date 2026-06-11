import React, { useState } from 'react';
import { X, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { AuthBrandHeader } from './AuthBrandHeader';

type ResetPasswordModalProps = {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (token: string, newPassword: string) => Promise<{ message: string }>;
};

const validatePassword = (password: string) =>
  password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

const inputClass = 'w-full rounded-2xl border border-black/[0.06] bg-white/90 p-3.5 text-sm font-medium text-baylink-text outline-none placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15';

export const ResetPasswordModal = ({ isOpen, token, onClose, onSuccess, onSubmit }: ResetPasswordModalProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen || !token) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validatePassword(newPassword)) {
      setError('密码至少8位，并包含大写字母、小写字母和数字');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await onSubmit(token, newPassword);
      setSuccessMessage(res.message || '密码已更新，请重新登录。');
    } catch (err: any) {
      const msg = (err?.error || err?.message || '').toString();
      if (msg.includes('重设链接无效') || msg.includes('expired') || msg.includes('invalid')) {
        setError('重设链接无效或已过期。');
      } else if (msg.includes('Password must')) {
        setError('密码至少8位，并包含大写字母、小写字母和数字');
      } else {
        setError(msg || '重设失败，请稍后再试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6 backdrop-blur-md animate-in fade-in">
      <div className="relative max-h-[90vh] w-full max-w-xs overflow-y-auto rounded-[28px] border border-black/[0.04] bg-baylink-bg-alt/95 p-7 shadow-elevated backdrop-blur-xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full border border-black/[0.06] bg-white/90 p-2 text-baylink-muted transition hover:text-baylink-text">
          <X size={18} />
        </button>
        <AuthBrandHeader compact />
        <h2 className="mb-1 text-center text-base font-semibold text-baylink-text">重设密码</h2>
        <p className="mb-5 text-center text-[11px] text-baylink-muted">设置您的新登录密码</p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {successMessage ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-2xl border border-baylink-green/15 bg-baylink-green-light/60 p-4 text-sm text-baylink-text">
              <CheckCircle size={18} className="mt-0.5 shrink-0 text-baylink-green" />
              <p>{successMessage}</p>
            </div>
            <button
              type="button"
              onClick={onSuccess}
              className="w-full rounded-2xl bg-baylink-green py-3.5 font-semibold text-white shadow-rest transition hover:bg-baylink-green-hover active:scale-[0.98]"
            >
              去登录
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              required
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密码"
            />
            <input
              required
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="确认新密码"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-baylink-green py-3.5 font-semibold text-white shadow-rest transition hover:bg-baylink-green-hover active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  保存中...
                </span>
              ) : (
                '更新密码'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
