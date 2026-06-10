import React, { useState } from 'react';
import { X, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

type ResetPasswordModalProps = {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (token: string, newPassword: string) => Promise<{ message: string }>;
};

const validatePassword = (password: string) =>
  password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/80 p-6 backdrop-blur-md animate-in fade-in">
      <div className="relative max-h-[90vh] w-full max-w-xs overflow-y-auto rounded-[2.5rem] bg-[#FFF8F0] p-8 shadow-2xl">
        <div className="absolute left-0 top-0 h-2 w-full bg-gradient-to-r from-green-400 to-teal-500" />
        <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-full bg-white p-2 text-gray-400 transition hover:text-gray-900">
          <X size={18} />
        </button>
        <h2 className="mb-1 text-center text-2xl font-black text-gray-900">重设密码</h2>
        <p className="mb-6 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">设置您的新密码</p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {successMessage ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-800">
              <CheckCircle size={18} className="mt-0.5 shrink-0" />
              <p>{successMessage}</p>
            </div>
            <button
              type="button"
              onClick={onSuccess}
              className="w-full rounded-2xl bg-gray-900 py-4 font-bold text-white shadow-lg transition hover:bg-gray-800 active:scale-95"
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
              className="w-full rounded-2xl bg-white p-4 font-bold placeholder:font-normal placeholder:text-gray-400"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密码"
            />
            <input
              required
              type="password"
              autoComplete="new-password"
              className="w-full rounded-2xl bg-white p-4 font-bold placeholder:font-normal placeholder:text-gray-400"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="确认新密码"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gray-900 py-4 font-bold text-white shadow-lg transition hover:bg-gray-800 active:scale-95 disabled:opacity-60"
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
