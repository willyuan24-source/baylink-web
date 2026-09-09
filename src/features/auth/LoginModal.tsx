// 登录 / 注册弹层
import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { ModalShell } from '../../components/ui/Modal';
import { api } from '../../lib/api';
import { mapAuthError, showAccountStatusNotice, validateContactValue, validateEmail, validatePassword } from '../../lib/format';
import type { UserData } from '../../lib/types';
import { AuthBrandHeader } from '../../components/AuthBrandHeader';

export const LoginModal = ({ onClose, onLogin, showToast, onForgotPassword }: { onClose: () => void; onLogin: (user: UserData) => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void; onForgotPassword: () => void }) => {
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', nickname: '', contactType: 'wechat', contactValue: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (mode === 'register') {
      if (!form.email.trim() || !form.password || !form.nickname.trim() || !form.contactValue.trim()) {
        setError('请填写完整注册信息');
        return;
      }
      if (!validateEmail(form.email)) {
        setError('请输入有效的邮箱地址');
        return;
      }
      if (!validatePassword(form.password)) {
        setError('密码至少8位，并包含大写字母、小写字母和数字');
        return;
      }
      if (!confirmPassword) {
        setError('请再次输入密码');
        return;
      }
      if (form.password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
      const contactError = validateContactValue(form.contactType, form.contactValue);
      if (contactError) { setError(contactError); return; }
    }

    setLoading(true);
    try {
      const payload = { email: form.email.trim(), password: form.password, nickname: form.nickname.trim(), contactType: form.contactType, contactValue: form.contactValue.trim() };
      const user = await api.request(mode === 'register' ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('currentUser', JSON.stringify(user));
      onLogin(user);
      onClose();
      showToast(mode === 'register' ? '欢迎加入 BayLink!' : '欢迎回来', 'success');
      if (mode === 'login') showAccountStatusNotice(user, showToast);
    } catch (e: any) {
      setError(mapAuthError(e, mode === 'register' ? 'register' : 'login'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full rounded-2xl border border-black/[0.06] bg-white/90 p-3.5 text-sm font-medium text-baylink-text outline-none placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15';

  return (
    // 注册模式有 5 个必填字段，误触遮罩不关闭（与旧版一致，仅 X / Esc 可关）
    <ModalShell onClose={onClose} closeOnBackdrop={false} label="登录 / 注册" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6 backdrop-blur-md animate-in fade-in">
      <div className="relative max-h-[90vh] w-full max-w-xs overflow-y-auto rounded-[28px] border border-black/[0.04] bg-baylink-bg-alt/95 p-7 shadow-elevated backdrop-blur-xl">
        <AuthBrandHeader />
        <p className="-mt-3 mb-5 text-center text-[12px] font-medium text-baylink-text">{mode === 'register' ? '创建你的湾区账号' : '欢迎回来'}</p>
        {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600"><AlertCircle size={14} />{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="auth-email" className="block text-xs font-medium">邮箱账号</label>
            <input id="auth-email" required type="email" autoComplete={mode === 'register' ? 'email' : 'username'} className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="邮箱地址" />
            <label htmlFor="auth-password" className="block text-xs font-medium">密码</label>
            <input id="auth-password" required type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className={inputClass} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="密码" />
            {mode === 'register' && (
              <>
                <label htmlFor="auth-confirm-password" className="block text-xs font-medium">确认密码</label>
                <input id="auth-confirm-password" required type="password" autoComplete="new-password" className={inputClass} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="再次输入密码" />
                <label htmlFor="auth-nickname" className="block text-xs font-medium">社区昵称</label>
                <input id="auth-nickname" required autoComplete="nickname" className={inputClass} value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} placeholder="社区昵称" />
                <div>
                  <label htmlFor="auth-contact-type" className="mb-2 block text-xs font-medium">联系方式类型</label>
                  <select id="auth-contact-type" className={`${inputClass} mb-2`} value={form.contactType} onChange={e => setForm({ ...form, contactType: e.target.value, contactValue: '' })}>
                    <option value="wechat">微信</option><option value="phone">电话</option><option value="email">邮箱</option>
                  </select>
                  <label htmlFor="auth-contact-value" className="mb-2 block text-xs font-medium">{form.contactType === 'wechat' ? '微信号' : form.contactType === 'phone' ? '电话号码' : '联系邮箱'}</label>
                  <input id="auth-contact-value" required type={form.contactType === 'phone' ? 'tel' : form.contactType === 'email' ? 'email' : 'text'} className={inputClass} value={form.contactValue} onChange={e => setForm({ ...form, contactValue: e.target.value })} placeholder={form.contactType === 'wechat' ? '微信号' : form.contactType === 'phone' ? '可包含国家代码，例如 +1 415 555 0123' : '联系邮箱'} />
                  <p className="mt-1 px-1.5 text-[11px] leading-relaxed text-baylink-muted">
                    仅用于账号信任与联系方式请求功能，不会公开显示。
                  </p>
                </div>
              </>
            )}
            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-[11px] font-semibold text-baylink-muted hover:text-baylink-green"
                >
                  忘记密码?
                </button>
              </div>
            )}
            {mode === 'register' && (
              <p className="px-1 text-center text-[11px] leading-relaxed text-baylink-muted">
                注册即代表你同意
                <a href="/terms" className="mx-0.5 font-semibold text-baylink-green hover:underline">《服务条款》</a>
                和
                <a href="/privacy" className="mx-0.5 font-semibold text-baylink-green hover:underline">《隐私政策》</a>
              </p>
            )}
            <button disabled={loading} className="w-full rounded-2xl bg-baylink-green py-3.5 font-semibold text-white shadow-rest transition hover:bg-baylink-green-hover active:scale-[0.98] disabled:opacity-60">{loading ? '处理中...' : (mode === 'register' ? '注册账号' : '立即登录')}</button>
        </form>
        <button disabled={loading} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setConfirmPassword(''); }} className="mt-5 w-full text-center text-xs text-baylink-muted hover:text-baylink-text">{mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}</button>
        <button onClick={onClose} aria-label="关闭登录注册" className="absolute right-4 top-4 rounded-full border border-black/[0.06] bg-white/90 p-2 text-baylink-muted transition hover:text-baylink-text"><X size={18} /></button>
      </div>
    </ModalShell>
  );
};
