import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useLocale } from '../i18n/locale';
import { setPageMetadata } from '../lib/seo';

type Kind = 'message' | 'contact_request' | 'outing_request' | 'comment';
const KINDS: Kind[] = ['message', 'contact_request', 'outing_request', 'comment'];
const isKind = (value: unknown): value is Kind => typeof value === 'string' && (KINDS as string[]).includes(value);
/** The settings card's own words for each kind (NotificationPreferencesCard), so a link names what it turns off. */
const KIND_NAMES: Record<Kind, { zh: string; en: string; hant: string }> = {
  message: { zh: '新的私信', en: 'new private messages', hant: '新的私訊' },
  contact_request: { zh: '新的联系请求', en: 'new contact requests', hant: '新的聯絡請求' },
  outing_request: { zh: '新的小队申请', en: 'new team applications', hant: '新的小隊申請' },
  comment: { zh: '我的帖子有新评论', en: 'new comments on my posts', hant: '我的帖子有新留言' },
};
type Result = { purpose: 'verify'; defaultsApplied: boolean } | { purpose: 'unsubscribe'; channel: 'email' | 'sms' | null; topic: Kind | null };

/**
 * The email token pages (/verify-email, /notifications/unsubscribe). The token (and, from api #44, the reminder kind) come in
 * the URL fragment, which never reaches a server, a referrer or page-view metrics; the confirm tap stays, so a mail scanner
 * that opens the link changes nothing. Every sentence is true whether or not the server's H14 email preset is on: the
 * verify page says what this verification turned on (`defaultsApplied`), the unsubscribe page names the kind it turns off
 * (`kind` from the link before the tap, `topic` from the answer after it) and keeps the whole-channel wording for links
 * from older emails, which still turn off the whole channel.
 */
export default function NotificationTokenPage({ purpose }: { purpose: 'verify' | 'unsubscribe' }) {
  const location = useLocation(), locale = useLocale(), en = locale === 'en', hant = locale === 'zh-Hant';
  const text = (hans: string, english: string, traditional = hans) => en ? english : hant ? traditional : hans;
  const [fragment] = useState(() => new URLSearchParams(location.hash.replace(/^#/, '')));
  const [token] = useState(() => fragment.get('token') || '');
  const [linkKind] = useState(() => { const kind = fragment.get('kind'); return isKind(kind) ? kind : null; });
  const [busy, setBusy] = useState(false), [result, setResult] = useState<Result | null>(null), [error, setError] = useState('');
  useEffect(() => setPageMetadata({
    title: `${purpose === 'verify' ? (en ? 'Verify email' : hant ? '驗證信箱' : '验证邮箱') : (en ? 'Unsubscribe from notifications' : '取消站外通知')}｜BAYLINK`,
    description: en ? 'Confirm your own request. Notification settings remain under your control.' : hant ? '確認本人的請求，自主選擇通知偏好。' : '确认本人的请求，自主选择通知偏好。',
    path: purpose === 'verify' ? '/verify-email' : '/notifications/unsubscribe', noindex: true, preserveText: true,
  }), [purpose, en, hant]);
  useEffect(() => {
    // Fragment tokens do not enter HTTP requests, referrers or page-view metrics.
    if (typeof window !== 'undefined' && window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);
  const valid = /^[A-Za-z0-9_-]{43}$/.test(token);
  const confirm = async () => {
    if (busy || result || !valid) return;
    setBusy(true); setError('');
    try {
      // `locale` (api #44, optional): the language of the page that confirms becomes the reminder language.
      const value = await api.request(purpose === 'verify' ? '/notifications/email/verify' : '/notifications/unsubscribe', { method: 'POST', body: JSON.stringify(purpose === 'verify' ? { token, locale } : { token }) }) as Record<string, unknown> | null;
      setResult(purpose === 'verify' ? { purpose, defaultsApplied: value?.defaultsApplied === true } : {
        purpose, channel: value?.channel === 'email' || value?.channel === 'sms' ? value.channel : null,
        // `topic: null` is an older whole-channel link; an older server that omits `topic` leaves the link's own kind.
        topic: isKind(value?.topic) ? value.topic : value && 'topic' in value ? null : linkKind,
      });
    } catch (err: any) { setError(err.error || text('链接无效或已过期，请重新请求。', 'This link is invalid or expired. Request a new one.', '連結無效或已過期，請重新請求。')); }
    finally { setBusy(false); }
  };
  const name = (kind: Kind) => { const { zh, en: english, hant: traditional } = KIND_NAMES[kind]; return text(`「${zh}」`, english, `「${traditional}」`); };
  const done = !result ? '' : result.purpose === 'verify'
    ? result.defaultsApplied
      ? text(`邮箱已验证。已按默认开启${name('message')}${name('contact_request')}两类邮件提醒，可在「我的 › 通知」关闭。`, `Email verified. Email reminders for ${name('message')} and ${name('contact_request')} are now on by default; you can turn them off in Me › Notifications.`, `信箱已驗證。已按預設開啟${name('message')}${name('contact_request')}兩類郵件提醒，可在「我的 › 通知」關閉。`)
      : text('邮箱已验证。可在「我的 › 通知」查看和更改邮件提醒。', 'Email verified. See or change your email reminders in Me › Notifications.', '信箱已驗證。可在「我的 › 通知」查看和更改郵件提醒。')
    : result.topic
      ? result.channel === 'sms'
        ? text(`已关闭${name(result.topic)}短信提醒。其他提醒不变，可在「我的 › 通知」重新开启。`, `Text reminders for ${name(result.topic)} are off. Other reminders are unchanged; you can turn them back on in Me › Notifications.`, `已關閉${name(result.topic)}簡訊提醒。其他提醒不變，可在「我的 › 通知」重新開啟。`)
        : text(`已关闭${name(result.topic)}邮件提醒。其他提醒不变，可在「我的 › 通知」重新开启。`, `Email reminders for ${name(result.topic)} are off. Other reminders are unchanged; you can turn them back on in Me › Notifications.`, `已關閉${name(result.topic)}郵件提醒。其他提醒不變，可在「我的 › 通知」重新開啟。`)
      : result.channel === 'sms' ? text('已关闭全部短信提醒。可在「我的 › 通知」重新开启。', 'All text reminders are off. You can turn them back on in Me › Notifications.', '已關閉全部簡訊提醒。可在「我的 › 通知」重新開啟。')
        : result.channel === 'email' ? text('已关闭全部邮件提醒。可在「我的 › 通知」重新开启。', 'All email reminders are off. You can turn them back on in Me › Notifications.', '已關閉全部郵件提醒。可在「我的 › 通知」重新開啟。')
          : text('已关闭这条链接对应的提醒。', 'The reminders for this link are turned off.', '已關閉這條連結對應的提醒。');
  const intro = purpose === 'verify'
    ? text('请确认这是你本人请求的邮箱验证。确认后，这里会说明邮件提醒的情况。', 'Confirm that you requested this verification. Once you confirm, this page says what happens to your email reminders.', '請確認這是你本人請求的信箱驗證。確認後，這裡會說明郵件提醒的情況。')
    : linkKind ? text(`确认后，将关闭这条链接对应的${name(linkKind)}提醒；其他提醒不变。`, `Confirm to turn off reminders for ${name(linkKind)} from this link. Other reminders stay as they are.`, `確認後，將關閉這條連結對應的${name(linkKind)}提醒；其他提醒不變。`)
      : text('确认后将关闭此链接对应的邮件或短信提醒。', 'Confirm to turn off email or SMS reminders for this link.', '確認後將關閉此連結對應的郵件或簡訊提醒。');
  return <main className="mx-auto max-w-xl p-6">
    <h1 className="text-2xl font-semibold">{purpose === 'verify' ? text('验证邮箱', 'Verify email', '驗證信箱') : text('取消站外通知', 'Unsubscribe from notifications', '取消站外通知')}</h1>
    {result ? <p role="status" className="my-5">{done}</p>
      : <><p className="my-5">{intro}</p>
        {!valid && <p role="alert">{text('链接无效或缺少验证令牌，请重新请求。', 'The link is invalid or missing its token. Request a new one.', '連結無效或缺少驗證令牌，請重新請求。')}</p>}
        {error && <p role="alert" className="my-3 text-red-700">{error}</p>}
        <button type="button" disabled={!valid || busy} onClick={() => void confirm()} className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-white">{busy ? text('正在确认…', 'Confirming…', '正在確認…') : text('确认', 'Confirm', '確認')}</button>
      </>}
    <p className="mt-6"><Link to={result ? '/me?view=notifications' : '/me'} className="underline">{result ? text('打开通知设置', 'Open notification settings', '打開通知設定') : text('回到个人页面', 'Return to your profile', '回到個人頁面')}</Link></p>
  </main>;
}
