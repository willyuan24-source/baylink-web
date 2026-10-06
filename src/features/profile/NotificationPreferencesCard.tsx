import React, { useEffect, useRef, useState } from 'react';
import { api, getStoredUser } from '../../lib/api';
import { useLocale } from '../../i18n/locale';

type Topic = 'message' | 'contact_request' | 'outing_request';
type Channel = 'email' | 'sms';
export type NotificationSettings = {
  preferences: Record<Channel, Record<Topic, boolean>>;
  emailVerified: boolean;
  phoneVerified: boolean;
  deliveryEnabled: boolean;
  emailDeliveryAvailable: boolean;
  smsDeliveryAvailable: boolean;
};
const topics: Topic[] = ['message', 'contact_request', 'outing_request'];
const channels: Channel[] = ['email', 'sms'];
const normalize = (value: NotificationSettings): NotificationSettings => ({ ...value, preferences: Object.fromEntries(channels.map(channel => [channel,
  Object.fromEntries(topics.map(topic => [topic, value.preferences?.[channel]?.[topic] === true])),
])) as NotificationSettings['preferences'] });

/** Opt-in is always an explicit authenticated save; legacy accounts start with all switches off. */
export function NotificationPreferencesCard({ userId }: { userId: string }) {
  const locale = useLocale(), en = locale === 'en', hant = locale === 'zh-Hant';
  const text = (hans: string, english: string, traditional = hans) => en ? english : hant ? traditional : hans;
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null), lock = useRef(false), generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current, controller = new AbortController();
    request.current?.abort(); request.current = controller; lock.current = false;
    setSettings(null); setError(''); setNotice(''); setBusy(false);
    api.request('/notifications/preferences', { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted && current === generation.current && getStoredUser()?.id === userId) setSettings(normalize(value));
    }).catch(err => { if (!controller.signal.aborted && current === generation.current) setError(err.error || text('通知设置暂不可用。', 'Notification settings are unavailable.', '通知設定暫不可用。')); });
    return () => { controller.abort(); generation.current++; };
  }, [userId, retry]);

  const submit = async (verification = false) => {
    if (lock.current || !settings || getStoredUser()?.id !== userId) return;
    const current = generation.current, controller = new AbortController();
    request.current?.abort(); request.current = controller; lock.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const value = await api.request(verification ? '/notifications/email/start' : '/notifications/preferences', {
        method: verification ? 'POST' : 'PATCH', signal: controller.signal,
        body: JSON.stringify(verification ? {} : { preferences: settings.preferences, locale }),
      });
      if (controller.signal.aborted || current !== generation.current || getStoredUser()?.id !== userId) return;
      setSettings(normalize(value));
      setNotice(verification ? value.alreadyVerified ? text('邮箱已验证。', 'Email already verified.', '信箱已驗證。')
        : value.emailDeliveryAvailable ? text('验证请求已排队，请查收邮件并在30分钟内确认。', 'Verification is queued. Check your email and confirm within 30 minutes.', '驗證請求已排隊，請查收郵件並在30分鐘內確認。')
          : text('验证请求已保存；邮件发送暂未启用，请稍后重新请求。', 'The request was saved. Email delivery is not enabled yet; request a new link later.', '驗證請求已儲存；郵件發送暫未啟用，請稍後重新請求。')
        : text('通知偏好已保存。', 'Notification preferences saved.', '通知偏好已儲存。'));
    } catch (err: any) { if (!controller.signal.aborted && current === generation.current) setError(err.error || text('保存失败，请重试。', 'Could not save. Try again.', '儲存失敗，請重試。')); }
    finally { if (current === generation.current) { lock.current = false; setBusy(false); } }
  };
  return <section className="mx-auto my-6 max-w-3xl rounded-2xl border border-stone-200 bg-white p-5" aria-labelledby="notification-settings-title">
    <h2 id="notification-settings-title" className="text-lg font-semibold">{text('站外通知', 'Email and SMS notifications', '站外通知')}</h2>
    <p className="mt-2 text-sm text-stone-600">{text('由你主动选择接收。提醒只包含安全的站内链接，不包含私信正文或联系方式。同一会话每30分钟最多提醒一次。', 'Choose which reminders to receive. They contain a secure site link, without private message text or contact details. At most one reminder per conversation every 30 minutes.', '由你主動選擇接收。提醒只包含安全的站內連結，不包含私訊正文或聯絡資料。同一對話每30分鐘最多提醒一次。')}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
    {!settings ? <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 underline">{error ? text('重试加载', 'Retry loading', '重試載入') : text('正在加载通知设置…', 'Loading notification settings…', '正在載入通知設定…')}</button> : <>
      {!settings.deliveryEnabled && <p className="mt-3 text-sm text-amber-800">{text('发送服务暂未启用；你仍可保存偏好。', 'Delivery is not enabled yet. You can still save your preferences.', '發送服務暫未啟用；你仍可儲存偏好。')}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{channels.map(channel => {
        const verified = channel === 'email' ? settings.emailVerified : settings.phoneVerified;
        return <fieldset key={channel} className="rounded-xl border border-stone-200 p-3" disabled={busy}>
          <legend className="px-1 font-medium">{channel === 'email' ? text('邮件提醒', 'Email reminders', '郵件提醒') : text('短信提醒', 'SMS reminders', '簡訊提醒')}</legend>
          <p className="mb-2 text-xs text-stone-600">{verified ? text('已验证', 'Verified', '已驗證') : channel === 'email' ? text('请先验证当前邮箱', 'Verify your current email first', '請先驗證目前信箱') : text('请先在个人资料中验证当前手机号', 'Verify your current phone in your profile first', '請先在個人資料中驗證目前手機號碼')}</p>
          {topics.map(topic => <label key={topic} className="my-2 flex gap-2 text-sm"><input type="checkbox" disabled={!verified || busy} checked={settings.preferences[channel][topic]}
            onChange={event => setSettings(previous => previous ? { ...previous, preferences: { ...previous.preferences, [channel]: { ...previous.preferences[channel], [topic]: event.target.checked } } } : previous)} />
            {topic === 'message' ? text('新的私信', 'New private messages', '新的私訊') : topic === 'contact_request' ? text('新的联系请求', 'New contact requests', '新的聯絡請求') : text('新的小队申请', 'New team applications', '新的小隊申請')}
          </label>)}
          {channel === 'email' && !verified && <button type="button" disabled={busy} onClick={() => void submit(true)} className="mt-2 rounded-lg border px-3 py-2 text-sm">{text('发送验证邮件', 'Request verification email', '發送驗證郵件')}</button>}
        </fieldset>;
      })}</div>
      <button type="button" disabled={busy} onClick={() => void submit()} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-white">{busy ? text('正在保存…', 'Saving…', '正在儲存…') : text('保存通知偏好', 'Save notification preferences', '儲存通知偏好')}</button>
      <p className="mt-2 text-xs text-stone-500">{text('随时取消勾选并保存即可退订，也可使用提醒中的退订链接。', 'Turn a switch off and save to unsubscribe, or use the unsubscribe link in a reminder.', '隨時取消勾選並儲存即可退訂，也可使用提醒中的退訂連結。')}</p>
    </>}
  </section>;
}
