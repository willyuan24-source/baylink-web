import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import { friendlyErrorMessage } from '../lib/format';
import { useUiCopy } from './ui/ui-copy';
import './site-dialogs.css';

type ForgotPasswordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<{ message: string; devResetLink?: string }>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 忘记密码 (RC-24: on the WEB-UI Sheet). A stray tap outside keeps the typed address: only ✕ and Esc close it. */
export const ForgotPasswordModal = ({ isOpen, onClose, onSubmit }: ForgotPasswordModalProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [devResetLink, setDevResetLink] = useState('');
  const { t } = useUiCopy();

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
    } catch (err) {
      setError(friendlyErrorMessage(err, '请求失败，请稍后再试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="忘记密码" closeOnBackdrop={false}>
      <p className="site-dialog-intro">{t('输入注册邮箱，我们会发送重设链接。', 'Enter the email you registered with and we will send a reset link.')}</p>
      {successMessage ? (
        <>
          <p role="status" className="site-dialog-success">{successMessage}</p>
          {devResetLink && <p className="site-dialog-dev">{t('开发模式测试链接：', 'Development test link: ')}<a href={devResetLink}>{devResetLink}</a></p>}
          <div className="site-dialog-actions"><Button variant="primary" onClick={onClose}>关闭</Button></div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="site-dialog-form" noValidate>
          <label className="site-dialog-label" htmlFor="forgot-password-email">注册邮箱</label>
          <input id="forgot-password-email" required type="email" autoComplete="email" className="site-dialog-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="注册邮箱" />
          {error && <p role="alert" className="site-dialog-error"><AlertCircle size={16} aria-hidden="true" />{error}</p>}
          <Button type="submit" variant="primary" disabled={loading} icon={loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : undefined}>{loading ? '发送中…' : '发送重设链接'}</Button>
        </form>
      )}
    </Sheet>
  );
};
