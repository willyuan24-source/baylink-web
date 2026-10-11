import React, { useState } from 'react';
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import './site-dialogs.css';
import { useUiCopy } from './ui/ui-copy';

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
  const { t } = useUiCopy();

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
    // RC-24: on the WEB-UI Sheet. Closing clears the reset token from the URL, so a stray tap outside does not close it.
    <Sheet open onClose={onClose} title="重设密码" closeOnBackdrop={false}>
      <p className="site-dialog-intro">{t('设置您的新登录密码：至少 8 位，包含大写字母、小写字母和数字。', 'Choose a new password: at least 8 characters with upper- and lower-case letters and a number.')}</p>
      {successMessage ? (
        <>
          <p role="status" className="site-dialog-success"><CheckCircle size={18} aria-hidden="true" /> {successMessage}</p>
          <div className="site-dialog-actions"><Button variant="primary" onClick={onSuccess}>去登录</Button></div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="site-dialog-form" noValidate>
          <label className="site-dialog-label" htmlFor="reset-password-new">新密码</label>
          <input id="reset-password-new" required type="password" autoComplete="new-password" className="site-dialog-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="新密码" />
          <label className="site-dialog-label" htmlFor="reset-password-confirm">确认新密码</label>
          <input id="reset-password-confirm" required type="password" autoComplete="new-password" className="site-dialog-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="确认新密码" />
          {error && <p role="alert" className="site-dialog-error"><AlertCircle size={16} aria-hidden="true" />{error}</p>}
          <Button type="submit" variant="primary" disabled={loading} icon={loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : undefined}>{loading ? '保存中…' : '更新密码'}</Button>
        </form>
      )}
    </Sheet>
  );
};
