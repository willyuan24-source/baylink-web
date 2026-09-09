// 登录 / 注册弹层
import React, { useState } from 'react';
import { X, AlertCircle, ArrowUpRight, LockKeyhole } from 'lucide-react';
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

  const inputClass = 'member-auth-input';

  return (
    // 注册模式有 5 个必填字段，误触遮罩不关闭（与旧版一致，仅 X / Esc 可关）
    <ModalShell onClose={onClose} closeOnBackdrop={false} label="登录 / 注册" className="member-auth-overlay">
      <div className="member-auth-dialog">
        <AuthBrandHeader />
        <div className="member-auth-heading">
          <h2>{mode === 'register' ? '你的湾区生活，从这里开始。' : '欢迎回来，邻居。'}</h2>
          <p>{mode === 'register' ? '创建账号，发布信息，与附近的人建立联系。' : '登录后继续聊天、管理发布，发现身边的好生活。'}</p>
        </div>
        {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600"><AlertCircle size={14} />{error}</div>}
        <form onSubmit={handleSubmit} className="member-auth-form">
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
                  className="member-text-action"
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
            <button disabled={loading} className="member-primary member-auth-submit">{loading ? '处理中...' : (mode === 'register' ? '注册账号' : '立即登录')}<ArrowUpRight size={18} aria-hidden="true" /></button>
        </form>
        <button disabled={loading} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setConfirmPassword(''); }} className="member-auth-switch">{mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}</button>
        <p className="member-auth-privacy"><LockKeyhole size={12} aria-hidden="true" />你的联系方式不会公开显示</p>
        <button onClick={onClose} aria-label="关闭登录注册" className="member-auth-close"><X size={18} /></button>
      </div>
    </ModalShell>
  );
};
