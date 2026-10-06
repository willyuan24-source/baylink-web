import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useLocale } from '../i18n/locale';
import { setPageMetadata } from '../lib/seo';

export default function NotificationTokenPage({ purpose }: { purpose: 'verify' | 'unsubscribe' }) {
  const location = useLocation(), locale = useLocale(), en = locale === 'en', hant = locale === 'zh-Hant';
  const text = (hans: string, english: string, traditional = hans) => en ? english : hant ? traditional : hans;
  const [token] = useState(() => new URLSearchParams(location.hash.replace(/^#/, '')).get('token') || '');
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
  useEffect(() => setPageMetadata({
    title: `${purpose === 'verify' ? (en ? 'Verify email' : hant ? '驗證信箱' : '验证邮箱') : (en ? 'Unsubscribe from notifications' : '取消站外通知')}｜BAYLINK`,
    description: en ? 'Confirm your own request. Notification settings remain under your control.' : hant ? '確認本人的請求，自主選擇通知偏好。' : '确认本人的请求，自主选择通知偏好。',
    path: purpose === 'verify' ? '/verify-email' : '/notifications/unsubscribe', noindex: true, preserveText: true,
  }), [purpose, en, hant]);
  useEffect(() => {
    // Fragment tokens do not enter HTTP requests, referrers or page-view metrics.
    if (typeof window !== 'undefined' && window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);
  const confirm = async () => {
    if (busy || done || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
    setBusy(true); setError('');
    try { await api.request(purpose === 'verify' ? '/notifications/email/verify' : '/notifications/unsubscribe', { method: 'POST', body: JSON.stringify({ token }) }); setDone(true); }
    catch (err: any) { setError(err.error || text('链接无效或已过期，请重新请求。', 'This link is invalid or expired. Request a new one.', '連結無效或已過期，請重新請求。')); }
    finally { setBusy(false); }
  };
  const valid = /^[A-Za-z0-9_-]{43}$/.test(token);
  return <main className="mx-auto max-w-xl p-6">
    <h1 className="text-2xl font-semibold">{purpose === 'verify' ? text('验证邮箱', 'Verify email', '驗證信箱') : text('取消站外通知', 'Unsubscribe from notifications', '取消站外通知')}</h1>
    {done ? <p role="status" className="my-5">{purpose === 'verify' ? text('邮箱已验证。请回到个人页面主动选择通知偏好。', 'Email verified. Choose your notification preferences in your profile.', '信箱已驗證。請回到個人頁面主動選擇通知偏好。') : text('此通知渠道已退订。', 'You have unsubscribed from this notification channel.', '此通知渠道已退訂。')}</p>
      : <><p className="my-5">{purpose === 'verify' ? text('请确认这是你本人请求的邮箱验证。验证不会自动开启通知。', 'Confirm that you requested this verification. Verification does not automatically enable notifications.', '請確認這是你本人請求的信箱驗證。驗證不會自動開啟通知。') : text('确认后将关闭此链接对应的邮件或短信提醒。', 'Confirm to turn off email or SMS reminders for this link.', '確認後將關閉此連結對應的郵件或簡訊提醒。')}</p>
        {!valid && <p role="alert">{text('链接无效或缺少验证令牌，请重新请求。', 'The link is invalid or missing its token. Request a new one.', '連結無效或缺少驗證令牌，請重新請求。')}</p>}
        {error && <p role="alert" className="my-3 text-red-700">{error}</p>}
        <button type="button" disabled={!valid || busy} onClick={() => void confirm()} className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-white">{busy ? text('正在确认…', 'Confirming…', '正在確認…') : text('确认', 'Confirm', '確認')}</button>
      </>}
    <p className="mt-6"><Link to="/me" className="underline">{text('回到个人页面', 'Return to your profile', '回到個人頁面')}</Link></p>
  </main>;
}
