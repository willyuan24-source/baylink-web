import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import type { UserData } from '../../lib/types';
import { useLocale, translateText } from '../../i18n/locale';

export function MfaLoginChallenge({ challengeToken, onComplete, onRestart, onClose }: {
  challengeToken: string; onComplete: (user: UserData) => void; onRestart: () => void; onClose: () => void;
}) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError('');
    try {
      const user = await api.request('/auth/login/totp', { method: 'POST', signal: controller.signal,
        body: JSON.stringify({ challengeToken, ...(recovery ? { recoveryCode: code } : { totpCode: code }) }) });
      if (mounted.current && !controller.signal.aborted) onComplete(user);
    } catch (failure) {
      if (!mounted.current || controller.signal.aborted) return;
      const value = failure as { code?: string; status?: number };
      setError(value?.code === 'MFA_CHALLENGE_EXPIRED' ? t('登录验证已过期或尝试过多，请返回重新输入密码。', 'This challenge expired or reached its attempt limit. Go back and enter your password again.')
        : value?.code === 'TOTP_UNAVAILABLE' ? t('验证器服务暂不可用，请使用未使用的恢复码。', 'Authenticator service is unavailable. Use an unused recovery code.')
        : value?.status === 429 ? t('验证次数过多，请稍后再试。', 'Too many attempts. Try again later.')
        : t('代码无效或已使用。请核对最新代码，或使用未使用的恢复码。', 'The code is invalid or already used. Enter a fresh authenticator code or an unused recovery code.'));
      setCode('');
    } finally { if (mounted.current) setBusy(false); if (active.current === controller) active.current = null; }
  };
  return <div className="member-auth-dialog" translate="no">
    <div className="member-auth-heading"><h2>{t('确认两步验证', 'Confirm two-step verification')}</h2><p>{t('密码已确认。请在五分钟内输入最新验证器代码或未使用的恢复码完成登录。', 'Your password is confirmed. Complete sign-in within five minutes with a fresh authenticator code or an unused recovery code.')}</p></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <form onSubmit={submit} className="member-auth-form">
      <label htmlFor="login-mfa-code">{recovery ? t('恢复码', 'Recovery code') : t('验证器六位代码', 'Six-digit authenticator code')}</label>
      <input id="login-mfa-code" className="member-auth-input" autoFocus required autoComplete="one-time-code" type="text" inputMode={recovery ? 'text' : 'numeric'} maxLength={recovery ? 64 : 6} value={code} disabled={busy} onChange={event => setCode(event.target.value.trim())} />
      <label className="flex items-center gap-3"><input type="checkbox" disabled={busy} checked={recovery} onChange={event => { setRecovery(event.target.checked); setCode(''); setError(''); }} />{t('使用恢复码', 'Use a recovery code')}</label>
      <button className="member-primary member-auth-submit" disabled={busy}>{busy ? t('正在验证…', 'Verifying…') : t('验证并登录', 'Verify and sign in')}</button>
    </form>
    <button type="button" className="member-auth-switch" disabled={busy} onClick={onRestart}>{t('返回密码登录', 'Back to password sign-in')}</button>
    <button type="button" className="member-auth-switch" onClick={() => { active.current?.abort(); onClose(); }}>{t('关闭', 'Close')}</button>
  </div>;
}
