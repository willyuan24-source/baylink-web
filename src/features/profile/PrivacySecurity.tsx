import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { UserData } from '../../lib/types';
import { translateText, useLocale } from '../../i18n/locale';
import { useProfileSessionGuard } from './useProfileSessionGuard';
import { DELETE_PHRASES, confirmsDeletion } from './account-deletion';

type SecurityStatus = { totpEnabled: boolean; setupAvailable: boolean; recoveryCodesRemaining: number };

type Setup = { secret: string; recoveryCodes: string[]; expiresAt: number };

export function downloadPrivateFile(filename: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PrivacySecurity({ user, onBack, onUpdateUser, onSessionEnded }: {
  user: UserData; onBack: () => void; onUpdateUser: (user: UserData) => void; onSessionEnded: () => void;
}) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const current = useProfileSessionGuard(user);
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [savedCodes, setSavedCodes] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [disableConfirmed, setDisableConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);

  const failureText = (failure: unknown) => {
    const value = failure as { code?: string; status?: number };
    switch (value?.code) {
      case 'CREDENTIAL_CONFIRMATION_REQUIRED': return t('请重新输入正确的当前密码。', 'Enter your correct current password again.');
      case 'MFA_INVALID': case 'MFA_REPLAY': return t('代码无效或已使用。请等待下一枚验证器代码，或使用未使用的恢复码。', 'The code is invalid or already used. Wait for the next authenticator code, or use an unused recovery code.');
      case 'TOTP_SETUP_EXPIRED': return t('设置已过期，或尚未确认保存恢复码。请重新设置。', 'Setup expired, or saving recovery codes was not confirmed. Start setup again.');
      case 'TOTP_SETUP_UNAVAILABLE': case 'TOTP_UNAVAILABLE': return t('验证器服务暂不可用。已启用的账号可用恢复码；未启用的账号可继续使用密码登录。', 'Authenticator service is unavailable. Enabled accounts can use recovery codes; accounts without it can continue signing in with their password.');
      case 'EXPORT_TOO_LARGE': return t('资料数量较大，请联系隐私支持安排完整导出。此次没有下载不完整文件。', 'Your data exceeds the instant export limit. Contact privacy support for a complete export; no incomplete file was downloaded.');
      case 'ADMIN_HANDOVER_REQUIRED': return t('管理员需要先安全移交权限，再以普通账号注销。', 'Administrators must safely hand over their role before deleting a regular account.');
      case 'ACCOUNT_OPERATIONS_PENDING': return t('其他账号操作尚未结束。请关闭其他正在提交的操作，稍后重试。', 'Other account operations are still running. Finish pending submissions and try again shortly.');
      case 'ACCOUNT_CHANGED': return t('账号状态已变化，请重新登录后确认。', 'Your account state changed. Sign in again before confirming.');
      // The API words these in the reader's language (the request carries `locale`).
      case 'DELETE_CONFIRMATION_REQUIRED': case 'ACCOUNT_DELETE_FAILED': case 'ACCOUNT_DELETE_INTERRUPTED':
        return typeof (failure as { error?: unknown })?.error === 'string' ? String((failure as { error: string }).error) : t('账号删除没有完成，请稍后重试。', 'Account deletion did not finish. Please try again later.');
      default: return value?.status === 429 ? t('验证次数过多，请稍后重试。', 'Too many attempts. Try again later.') : t('操作没有确认成功。请重新登录检查账号状态后再试。', 'The operation was not confirmed. Sign in again, check your account, and retry.');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    api.request('/users/me/security', { signal: controller.signal }).then(value => {
      if (current() && !controller.signal.aborted) setStatus(value);
    }).catch(() => { if (current() && !controller.signal.aborted) { setFailed(true); setNotice(t('暂时无法读取安全状态，请返回后重试。', 'Security status is unavailable. Go back and try again.')); } });
    return () => { controller.abort(); active.current?.abort(); };
    // This keyed profile session is remounted when the login token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.token]);

  const credentials = () => ({ password, ...(recovery ? { recoveryCode: code } : { totpCode: code }) });
  const run = async (endpoint: string, method: string, extra: Record<string, unknown>, success: (value: any) => void) => {
    if (busy || active.current) return;
    if (!password) { setFailed(true); setNotice(t('请输入当前密码确认操作。', 'Enter your current password to confirm this operation.')); return; }
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setNotice(''); setFailed(false);
    try {
      const result = await api.request(endpoint, { method, body: JSON.stringify({ ...credentials(), ...extra }), signal: controller.signal });
      if (current() && !controller.signal.aborted) success(result);
    } catch (failure) {
      if (current() && !controller.signal.aborted) { setNotice(failureText(failure)); setFailed(true); }
    } finally {
      if (current()) { setPassword(''); setCode(''); setBusy(false); }
      if (active.current === controller) active.current = null;
    }
  };
  const rotateSession = (value: { user: UserData }) => {
    try { localStorage.setItem('currentUser', JSON.stringify(value.user)); } catch { /* React session still rotates. */ }
    onUpdateUser(value.user);
  };
  const showCodes = (values: string[]) => { setCodes(values); setSavedCodes(false); };

  return <section className="account-privacy" translate="no" aria-labelledby="account-privacy-title">
    <button type="button" onClick={onBack} disabled={busy}>{t('返回我的', 'Back to Me')}</button>
    <h1 id="account-privacy-title">{t('账号隐私与安全', 'Account privacy and security')}</h1>
    <p>{t('敏感操作每次都需要当前密码。启用两步验证后，还需要最新代码或未使用的恢复码。', 'Each sensitive operation requires your current password. When two-step verification is enabled, also enter a fresh authenticator code or unused recovery code.')}</p>
    {notice && <p role={failed ? 'alert' : 'status'} className={failed ? 'account-privacy-error' : 'account-privacy-status'}>{notice}</p>}
    <fieldset disabled={busy || !status}>
      <legend>{t('凭证确认', 'Confirm credentials')}</legend>
      <label htmlFor="privacy-password">{t('当前密码', 'Current password')}</label>
      <input id="privacy-password" type="password" autoComplete="current-password" maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />
      {(status?.totpEnabled || setup) && <>
        {status?.totpEnabled && <label className="account-privacy-check"><input type="checkbox" checked={recovery} onChange={event => { setRecovery(event.target.checked); setCode(''); }} />{t('使用恢复码', 'Use a recovery code')}</label>}
        <label htmlFor="privacy-code">{recovery ? t('未使用的恢复码', 'Unused recovery code') : t('验证器六位代码', 'Six-digit authenticator code')}</label>
        <input id="privacy-code" type="text" autoComplete="one-time-code" inputMode={recovery ? 'text' : 'numeric'} maxLength={recovery ? 64 : 6} value={code} onChange={event => setCode(event.target.value.trim())} />
      </>}
    </fieldset>
    <section>
      <h2>{t('下载我的资料', 'Download my data')}</h2>
      <p>{t('包含你的资料、发布、自己发送的文字和计划。其他人的私信、联系方式和安全密钥不在导出中。下载文件含私人资料，请妥善保管。', 'Includes your profile, posts, authored text messages and plans. Other people’s messages, contact details and security secrets are excluded. The downloaded file contains private data; store it safely.')}</p>
      <button type="button" disabled={busy || !status} onClick={() => void run('/users/me/privacy/export', 'POST', {}, value => {
        downloadPrivateFile('baylink-account.json', JSON.stringify(value, null, 2)); setNotice(t('资料文件已准备下载。', 'Your data file is ready to download.'));
      })}>{t('确认并下载资料', 'Confirm and download data')}</button>
    </section>
    <section>
      <h2>{t('退出所有登录', 'Sign out all sessions')}</h2>
      <p>{t('撤销当前及其他设备的登录令牌，之后需要重新登录。', 'Revoke your current session and sessions on other devices. You will need to sign in again.')}</p>
      <button type="button" disabled={busy || !status} onClick={() => void run('/users/me/security/revoke-sessions', 'POST', {}, onSessionEnded)}>{t('确认并退出所有登录', 'Confirm and sign out all sessions')}</button>
    </section>
    {user.role === 'admin' && <section>
      <h2>{t('管理员两步验证', 'Administrator two-step verification')}</h2>
      <p>{status?.totpEnabled ? t('已启用。密码登录后还需验证器或恢复码。', 'Enabled. Password sign-in also requires an authenticator or recovery code.') : t('尚未启用。必须保存恢复码并验证首枚代码后才会开启。', 'Not enabled. Activation requires saved recovery codes and confirmation with your first authenticator code.')}</p>
      {status && !status.setupAvailable && !status.totpEnabled && <p>{t('服务器尚未配置独立加密密钥，设置暂不可用。当前密码登录保持可用。', 'The server has not configured a separate encryption key. Setup is unavailable; password sign-in remains available.')}</p>}
      {!status?.totpEnabled && !setup && <button type="button" disabled={busy || !status?.setupAvailable} onClick={() => void run('/users/me/security/totp/setup', 'POST', {}, value => { setSetup(value); showCodes(value.recoveryCodes); setRecovery(false); })}>{t('开始设置验证器', 'Set up an authenticator')}</button>}
      {setup && <div className="account-privacy-secret">
        <p>{t('在验证器中添加 BAYLINK，手动输入以下密钥，使用30秒更新的六位代码。十分钟内确认；离开此页不会启用。不要分享密钥。', 'Add BAYLINK to your authenticator with this key, using six-digit codes that update every 30 seconds. Confirm within ten minutes. Leaving this page does not enable it. Keep the key private.')}</p>
        <code>{setup.secret}</code>
        <button type="button" disabled={busy || !savedCodes || !code || recovery} onClick={() => void run('/users/me/security/totp/confirm', 'POST', { recoveryCodesSaved: savedCodes }, rotateSession)}>{t('验证代码并启用', 'Verify code and enable')}</button>
        <button type="button" disabled={busy} onClick={() => { setSetup(null); setCodes([]); setSavedCodes(false); setCode(''); }}>{t('取消设置', 'Cancel setup')}</button>
      </div>}
      {status?.totpEnabled && <>
        <p>{t('剩余恢复码：', 'Recovery codes remaining: ')}{status.recoveryCodesRemaining}</p>
        <button type="button" disabled={busy} onClick={() => void run('/users/me/security/totp/recovery-codes', 'POST', {}, value => { showCodes(value.recoveryCodes); setStatus({ ...status, recoveryCodesRemaining: value.recoveryCodes.length }); })}>{t('确认并更换恢复码（旧码失效）', 'Confirm and replace recovery codes (old codes stop working)')}</button>
        <label className="account-privacy-check"><input type="checkbox" checked={disableConfirmed} onChange={event => setDisableConfirmed(event.target.checked)} />{t('我确认关闭两步验证，密码将成为唯一登录凭证。', 'I confirm disabling two-step verification; my password will be the only sign-in credential.')}</label>
        <button type="button" disabled={busy || !disableConfirmed} onClick={() => void run('/users/me/security/totp/disable', 'POST', {}, rotateSession)}>{t('确认凭证并停用验证器', 'Confirm credentials and disable authenticator')}</button>
      </>}
      {!!codes.length && <div className="account-privacy-secret">
        <h3>{t('恢复码仅在此处显示', 'Recovery codes are displayed only here')}</h3>
        <p>{t('每枚仅可使用一次。保存在其他安全位置，不要与账号密码放在一起。离开此页后不会再显示这些明文码。', 'Each code works once. Keep them somewhere safe, separate from your password. These plaintext codes will not be displayed after leaving this page.')}</p>
        <pre>{codes.join('\n')}</pre>
        <button type="button" onClick={() => downloadPrivateFile('baylink-recovery-codes.json', JSON.stringify({ account: user.email, recoveryCodes: codes }, null, 2))}>{t('下载恢复码到本机', 'Download recovery codes to this device')}</button>
        <label className="account-privacy-check"><input type="checkbox" checked={savedCodes} onChange={event => setSavedCodes(event.target.checked)} />{t('我已在安全位置保存全部恢复码。', 'I have saved all recovery codes somewhere safe.')}</label>
        {!setup && <button type="button" disabled={!savedCodes} onClick={() => setCodes([])}>{t('完成，隐藏恢复码', 'Done, hide recovery codes')}</button>}
      </div>}
    </section>}
    <section className="account-privacy-danger">
      <h2>{t('永久注销账号', 'Permanently delete my account')}</h2>
      <p>{t('这会删除账号、本人联系方式和消息，移除本人发布与计划，并撤销所有登录。无法恢复。非私密安全审计记录保留去标识信息；依法保留的备份和外部图片缓存不承诺即时清除。', 'This deletes your account, your contact details and messages, removes your posts and plans, and revokes all sessions. It cannot be undone. Non-private safety audit records retain anonymized information; retained backups and external image caches are not promised immediate erasure.')}</p>
      {user.role === 'admin' ? <p>{t('管理员请先安全移交管理权限，之后以普通账号注销。此处不会删除管理员。', 'Administrators must safely hand over their role before deleting a regular account. This control cannot delete an administrator.')}</p> : <>
        <button type="button" disabled={busy || !status} onClick={() => setDeleteOpen(!deleteOpen)}>{deleteOpen ? t('取消注销', 'Cancel account deletion') : t('查看注销确认', 'Review account deletion')}</button>
        {deleteOpen && <>
          <label htmlFor="privacy-delete-confirm">{locale === 'en' ? `Type ${DELETE_PHRASES.en} to confirm irreversible deletion` : locale === 'zh-Hant' ? `輸入「${DELETE_PHRASES['zh-Hant']}」確認不可恢復的註銷` : `输入「${DELETE_PHRASES['zh-Hans']}」确认不可恢复的注销`}</label>
          <input id="privacy-delete-confirm" autoComplete="off" aria-describedby="privacy-delete-hint" value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          <p id="privacy-delete-hint" className="account-privacy-hint">{locale === 'en' ? 'Spaces and letter case do not matter.' : t(`也可以输入 ${DELETE_PHRASES.en}。`, 'Spaces and letter case do not matter.')}</p>
          <button type="button" className="account-privacy-delete" disabled={busy || !confirmsDeletion(confirmation)} onClick={() => void run('/users/me/privacy/account', 'DELETE', { confirmation, locale }, onSessionEnded)}>{t('确认密码并永久注销', 'Confirm password and permanently delete account')}</button>
        </>}
      </>}
    </section>
    {busy && <p role="status">{t('正在处理，请等待确认结果。', 'Processing. Wait for the confirmed result.')}</p>}
  </section>;
}
