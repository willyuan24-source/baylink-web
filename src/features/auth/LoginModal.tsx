// 登录 / 注册弹层
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronRight, LockKeyhole } from 'lucide-react';
import { Sheet } from '../../components/ui/Sheet';
import '../../components/site-dialogs.css';
import { api } from '../../lib/api';
import { mapAuthError, showAccountStatusNotice, validateContactValue, validateEmail, validatePassword } from '../../lib/format';
import type { UserData } from '../../lib/types';
import { AuthBrandHeader } from '../../components/AuthBrandHeader';
import { MfaLoginChallenge } from './MfaLoginChallenge';
import { useLocale, translateText } from '../../i18n/locale';
import { recordProductEvent } from '../../lib/product-events';
import { loginIntent, rememberSignedIn, signedInBefore } from './login-intent';
import { COMMUNITY_VISIBLE } from '../../data/site-flags';

export const LoginModal = ({ onClose, onLogin, showToast, onForgotPassword }: { onClose: () => void; onLogin: (user: UserData) => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void; onForgotPassword: () => void }) => {
  // H76: opened by a guest's 私信 / 请求联系方式, the sheet names that scene and leads with 注册 (登录 for a browser that has
  // signed in before); opened any other way it is the generic sheet, on 登录.
  const [intent] = useState(loginIntent);
  const [mode, setMode] = useState<'login'|'register'>(() => intent && !signedInBefore() ? 'register' : 'login');
  const [form, setForm] = useState({ email: '', password: '', nickname: '', contactType: 'wechat', contactValue: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const activeRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  // With a mouse and keyboard the sheet opens in the email field, as the dialog did before the Sheet (a desktop reader types
  // at once). On a touch screen the ✕ takes focus, so the on-screen keyboard does not cover the sheet before it is read.
  const emailRef = useRef<HTMLInputElement>(null);
  const [typeFirst] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches));

  // One signup_gate per time the sign-in / register sheet is shown (G10: the gate was never counted).
  useEffect(() => { recordProductEvent('signup_gate'); }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, []);

  const cancelRequest = () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
  };
  const close = () => { cancelRequest(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRequest.current) return;
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

    const controller = new AbortController();
    activeRequest.current = controller;
    const isCurrent = () => mounted.current && activeRequest.current === controller && !controller.signal.aborted;
    setLoading(true);
    try {
      const payload = { email: form.email.trim(), password: form.password, nickname: form.nickname.trim(), contactType: form.contactType, contactValue: form.contactValue.trim(), ...(mode === 'register' ? { locale } : {}) };
      const user = await api.request(mode === 'register' ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(payload), signal: controller.signal });
      if (!isCurrent()) return;
      if (user.mfaRequired === true && typeof user.challengeToken === 'string') {
        setForm({ ...form, password: '' }); setChallengeToken(user.challengeToken); return;
      }
      localStorage.setItem('currentUser', JSON.stringify(user)); rememberSignedIn();
      onLogin(user);
      onClose();
      showToast(mode === 'register' ? '欢迎加入 BayLink!' : '欢迎回来', 'success');
      if (mode === 'login') showAccountStatusNotice(user, showToast);
    } catch (e: unknown) {
      if (isCurrent()) setError(mapAuthError(e, mode === 'register' ? 'register' : 'login'));
    } finally {
      if (isCurrent()) { activeRequest.current = null; setLoading(false); }
    }
  };

  const inputClass = 'member-auth-input';
  // The poster's nickname is their own text: it is appended, never passed through the zh-Hant conversion.
  const intentName = intent?.name?.trim().slice(0, 40);
  const intentTitle = mode === 'register' ? (intentName ? `${t('注册后私信', 'Sign up to message')} ${intentName}` : t('注册后发私信', 'Sign up to send a message'))
    : intentName ? `${t('登录后私信', 'Sign in to message')} ${intentName}` : t('登录后发私信', 'Sign in to send a message');

  // RC-24: the sign-in sheet (WEB-UI Sheet: bottom sheet on phones, drawer on desktop). The register form has five
  // required fields, so a stray tap outside never closes it: only ✕ and Esc do.
  if (challengeToken) return <Sheet open onClose={close} closeOnBackdrop={false} title={locale === 'en' ? 'Two-step verification' : translateText('两步验证', locale)}><div className="member-auth-dialog">
    <MfaLoginChallenge challengeToken={challengeToken} onClose={close} onRestart={() => { setChallengeToken(null); setError(''); }} onComplete={user => {
      localStorage.setItem('currentUser', JSON.stringify(user)); rememberSignedIn(); onLogin(user); onClose();
      showToast(locale === 'en' ? 'Welcome back' : translateText('欢迎回来', locale), 'success');
      showAccountStatusNotice(user, showToast);
    }} />
  </div></Sheet>;

  return (
    <Sheet open onClose={close} closeOnBackdrop={false} initialFocusRef={typeFirst ? emailRef : undefined} title={intent ? intentTitle : mode === 'register' ? t('注册', 'Create an account') : t('登录', 'Sign in')}>
      <div className="member-auth-dialog">
        {/* H34 (HOMEIA13-06): the site's one positioning line, as in the footer and /me, in all three languages. */}
        <AuthBrandHeader tagline={t('湾区去哪、怎么办 · 有来源的中文答案', 'Where to go and how to get it done in the Bay, with sources')} />
        <div className="member-auth-heading">
          <h2>{mode === 'register' ? t('注册后，BayBay 能帮你更多', 'Create an account and BayBay can do more for you') : t('欢迎回来，邻居。', 'Welcome back, neighbor.')}</h2>
          {/* H77: post saves stay on the device (the favorites API has no post kind). While the board is paused
              (COMMUNITY_VISIBLE = false) the sheet promises no posting and names no posts. */}
          <p>{COMMUNITY_VISIBLE
            ? mode === 'register' ? t('收藏（邻里信息除外）和行程跟着账号走，换手机也在；也可以发布信息、收发私信。', 'Saved items (except neighborhood posts) and plans follow your account to any phone; you can also post and send messages.')
              : t('登录后继续聊天、管理发布；收藏（邻里信息除外）和行程跟着账号走。', 'Sign in to keep chatting and manage your posts; saved items (except neighborhood posts) and plans follow your account.')
            : mode === 'register' ? t('收藏和行程跟着账号走，换手机也在；也可以收发私信。', 'Your saved items and plans follow your account to any phone; you can also send messages.')
              : t('登录后继续聊天；收藏和行程跟着账号走。', 'Sign in to keep chatting; your saved items and plans follow your account.')}</p>
        </div>
        {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-normal text-red-600"><AlertCircle size={14} />{error}</div>}
        {intent && <p className="member-auth-intent">{mode === 'register' ? t('发私信需要账号，注册约 1 分钟。对方回复会出现在「消息」里，并显示未读数。', 'Messaging needs an account, and signing up takes about a minute. Replies appear in Messages with an unread count.') : t('登录后就能发私信。对方回复会出现在「消息」里，并显示未读数。', 'Sign in to send the message. Replies appear in Messages with an unread count.')}</p>}
        <form onSubmit={handleSubmit} className="member-auth-form">
            <label htmlFor="auth-email" className="block text-xs font-normal">{mode === 'register' ? '邮箱账号' : '邮箱或用户名'}</label>
            <input ref={emailRef} id="auth-email" required type={mode === 'register' ? 'email' : 'text'} autoComplete={mode === 'register' ? 'email' : 'username'} className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={mode === 'register' ? '邮箱地址' : '邮箱或用户名'} />
            <label htmlFor="auth-password" className="block text-xs font-normal">密码</label>
            <input id="auth-password" required type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className={inputClass} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="密码" />
            {mode === 'register' && (
              <>
                <label htmlFor="auth-confirm-password" className="block text-xs font-normal">确认密码</label>
                <input id="auth-confirm-password" required type="password" autoComplete="new-password" className={inputClass} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="再次输入密码" />
                <label htmlFor="auth-nickname" className="block text-xs font-normal">社区昵称</label>
                <input id="auth-nickname" required autoComplete="nickname" className={inputClass} value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} placeholder="社区昵称" />
                <div>
                  <label htmlFor="auth-contact-type" className="mb-2 block text-xs font-normal">联系方式类型</label>
                  <select id="auth-contact-type" className={`${inputClass} mb-2`} value={form.contactType} onChange={e => setForm({ ...form, contactType: e.target.value, contactValue: '' })}>
                    <option value="wechat">微信</option><option value="phone">电话</option><option value="email">邮箱</option>
                  </select>
                  <label htmlFor="auth-contact-value" className="mb-2 block text-xs font-normal">{form.contactType === 'wechat' ? '微信号' : form.contactType === 'phone' ? '电话号码' : '联系邮箱'}</label>
                  <input id="auth-contact-value" required type={form.contactType === 'phone' ? 'tel' : form.contactType === 'email' ? 'email' : 'text'} className={inputClass} value={form.contactValue} onChange={e => setForm({ ...form, contactValue: e.target.value })} placeholder={form.contactType === 'wechat' ? '微信号' : form.contactType === 'phone' ? '可包含国家代码，例如 +1 415 555 0123' : '联系邮箱'} />
                  <p className="mt-1 px-1.5 text-[0.6875rem] leading-relaxed text-baylink-muted">
                    仅用于账号信任与联系方式请求功能，不会公开显示。
                  </p>
                </div>
              </>
            )}
            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { cancelRequest(); onForgotPassword(); }}
                  className="member-text-action"
                >
                  忘记密码?
                </button>
              </div>
            )}
            {mode === 'register' && (
              <p className="px-1 text-center text-[0.6875rem] leading-relaxed text-baylink-muted">
                注册即代表你同意
                <a href="/terms" className="mx-0.5 font-semibold text-baylink-green hover:underline">《服务条款》</a>
                和
                <a href="/privacy" className="mx-0.5 font-semibold text-baylink-green hover:underline">《隐私政策》</a>
              </p>
            )}
            <button disabled={loading} className="member-primary member-auth-submit">{loading ? '处理中...' : (mode === 'register' ? '注册账号' : '立即登录')}<ChevronRight size={18} aria-hidden="true" /></button>
        </form>
        <button disabled={loading} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setConfirmPassword(''); }} className="member-auth-switch">{mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}</button>
        <p className="member-auth-privacy"><LockKeyhole size={12} aria-hidden="true" />你的联系方式不会公开显示</p>
      </div>
    </Sheet>
  );
};
