import { useEffect, useRef, useState } from 'react';
import { api, getStoredUser } from '../../lib/api';
import { useLocale } from '../../i18n/locale';

type Topic = 'message' | 'contact_request' | 'outing_request' | 'comment';
type Channel = 'email' | 'sms';
export type NotificationSettings = {
  preferences: Record<Channel, Record<Topic, boolean>>;
  /** The topics this server accepts. Servers before API-NOTIFY-SEC do not report it and know the first three only. */
  topics: Topic[];
  emailVerified: boolean;
  phoneVerified: boolean;
  deliveryEnabled: boolean;
  emailDeliveryAvailable: boolean;
  smsDeliveryAvailable: boolean;
};
const DEFAULT_TOPICS: Topic[] = ['message', 'contact_request', 'outing_request'];
const KNOWN_TOPICS: Topic[] = [...DEFAULT_TOPICS, 'comment'];
const channels: Channel[] = ['email', 'sms'];
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const serverTopics = (value: unknown): Topic[] => {
  if (!Array.isArray(value)) return DEFAULT_TOPICS;
  const topics = KNOWN_TOPICS.filter(topic => value.includes(topic));
  return topics.length ? topics : DEFAULT_TOPICS;
};
const normalize = (value: unknown): NotificationSettings => {
  const source = record(value), preferences = record(source.preferences);
  return {
    preferences: Object.fromEntries(channels.map(channel => [channel,
      Object.fromEntries(KNOWN_TOPICS.map(topic => [topic, record(preferences[channel])[topic] === true])),
    ])) as NotificationSettings['preferences'],
    topics: serverTopics(source.topics),
    emailVerified: source.emailVerified === true,
    phoneVerified: source.phoneVerified === true,
    deliveryEnabled: source.deliveryEnabled === true,
    emailDeliveryAvailable: source.emailDeliveryAvailable === true,
    smsDeliveryAvailable: source.smsDeliveryAvailable === true,
  };
};
const verifiedChannels = (settings: NotificationSettings) => channels.filter(channel => channel === 'email' ? settings.emailVerified : settings.phoneVerified);
/** True when every topic on every verified channel is on: the one-tap "enable all" has nothing left to do. */
export const allRemindersOn = (settings: NotificationSettings) => verifiedChannels(settings).length > 0
  && verifiedChannels(settings).every(channel => settings.topics.every(topic => settings.preferences[channel][topic]));
/** The PATCH body: only the topics the server reported, so an older API never sees an unknown topic. */
const preferencePayload = (settings: NotificationSettings) => Object.fromEntries(channels.map(channel => [channel,
  Object.fromEntries(settings.topics.map(topic => [topic, settings.preferences[channel][topic]]))]));
type RequestSession = { cancelled: boolean; request: AbortController | null; locked: boolean };
type RequestError = { kind: 'load' | 'save'; message?: string };
type Notice = '' | 'saved' | 'verified' | 'queued' | 'delivery_disabled' | 'all_on';
const serverError = (value: unknown): string | undefined => {
  const message = record(value).error;
  return typeof message === 'string' && message.length > 0 && message.length <= 512 ? message : undefined;
};

/**
 * Opt-in is always an explicit authenticated save; legacy accounts start with all switches off. Once a channel is
 * verified, "开启全部提醒" turns on every topic for the verified channels in one tap (an explicit save of the same
 * PATCH the checkboxes use, so it works before and after the server's own enableAll field ships).
 */
export function NotificationPreferencesCard({ userId }: { userId: string }) {
  const locale = useLocale(), en = locale === 'en', hant = locale === 'zh-Hant';
  const text = (hans: string, english: string, traditional = hans) => en ? english : hant ? traditional : hans;
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<RequestError | null>(null), [notice, setNotice] = useState<Notice>(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const activeSession = useRef<RequestSession | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const session: RequestSession = { cancelled: false, request: controller, locked: false };
    activeSession.current?.request?.abort(); activeSession.current = session;
    setSettings(null); setError(null); setNotice(''); setBusy(false);
    api.request('/notifications/preferences', { signal: controller.signal }).then(value => {
      if (!session.cancelled && !controller.signal.aborted && activeSession.current === session && getStoredUser()?.id === userId) setSettings(normalize(value));
    }).catch(err => {
      if (!session.cancelled && !controller.signal.aborted && activeSession.current === session) setError({ kind: 'load', message: serverError(err) });
    });
    // Capture this account's session, including a later save request, so cleanup cannot abort a replacement account.
    return () => { session.cancelled = true; session.request?.abort(); };
  }, [userId, retry]);

  const submit = async (mode: 'save' | 'verify' | 'all' = 'save') => {
    const session = activeSession.current;
    if (!session || session.cancelled || session.locked || !settings || getStoredUser()?.id !== userId) return;
    const controller = new AbortController();
    session.request?.abort(); session.request = controller; session.locked = true;
    const isCurrent = () => !session.cancelled && activeSession.current === session && getStoredUser()?.id === userId;
    const draft: NotificationSettings = mode !== 'all' ? settings : {
      ...settings,
      preferences: Object.fromEntries(channels.map(channel => [channel, verifiedChannels(settings).includes(channel)
        ? { ...settings.preferences[channel], ...Object.fromEntries(settings.topics.map(topic => [topic, true])) }
        : settings.preferences[channel]])) as NotificationSettings['preferences'],
    };
    setBusy(true); setError(null); setNotice('');
    try {
      const value = await api.request(mode === 'verify' ? '/notifications/email/start' : '/notifications/preferences', {
        method: mode === 'verify' ? 'POST' : 'PATCH', signal: controller.signal,
        body: JSON.stringify(mode === 'verify' ? {} : { preferences: preferencePayload(draft), locale }),
      });
      if (controller.signal.aborted || !isCurrent()) return;
      setSettings(normalize(value));
      const response = record(value);
      setNotice(mode === 'verify' ? response.alreadyVerified === true ? 'verified' : response.emailDeliveryAvailable === true ? 'queued' : 'delivery_disabled' : mode === 'all' ? 'all_on' : 'saved');
    } catch (err: unknown) { if (!controller.signal.aborted && isCurrent()) setError({ kind: 'save', message: serverError(err) }); }
    finally { if (isCurrent()) { session.locked = false; setBusy(false); } }
  };
  const errorText = error?.message || (error?.kind === 'load'
    ? text('通知设置暂不可用。', 'Notification settings are unavailable.', '通知設定暫不可用。')
    : text('保存失败，请重试。', 'Could not save. Try again.', '儲存失敗，請重試。'));
  const noticeText = notice === 'verified' ? text('邮箱已验证。', 'Email already verified.', '信箱已驗證。')
    : notice === 'queued' ? text('验证请求已排队，请查收邮件并在30分钟内确认。', 'Verification is queued. Check your email and confirm within 30 minutes.', '驗證請求已排隊，請查收郵件並在30分鐘內確認。')
      : notice === 'delivery_disabled' ? text('验证请求已保存；邮件发送暂未启用，请稍后重新请求。', 'The request was saved. Email delivery is not enabled yet; request a new link later.', '驗證請求已儲存；郵件發送暫未啟用，請稍後重新請求。')
        : notice === 'all_on' ? text('已开启全部提醒。随时可以取消勾选并保存。', 'All reminders are on. You can turn any of them off and save.', '已開啟全部提醒。隨時可以取消勾選並儲存。')
          : text('通知偏好已保存。', 'Notification preferences saved.', '通知偏好已儲存。');
  const topicLabel = (topic: Topic) => topic === 'message' ? text('新的私信', 'New private messages', '新的私訊')
    : topic === 'contact_request' ? text('新的联系请求', 'New contact requests', '新的聯絡請求')
      : topic === 'outing_request' ? text('新的小队申请', 'New team applications', '新的小隊申請')
        : text('我的帖子有新评论', 'New comments on my posts', '我的帖子有新留言');
  const canEnableAll = !!settings && verifiedChannels(settings).length > 0 && !allRemindersOn(settings);
  return <section className="me-notify" aria-labelledby="notification-settings-title">
    <h2 id="notification-settings-title">{text('站外通知', 'Email and SMS notifications', '站外通知')}</h2>
    <p>{text('由你主动选择接收。提醒只包含安全的站内链接，不包含私信正文或联系方式。同一会话每30分钟最多提醒一次。', 'Choose which reminders to receive. They contain a secure site link, without private message text or contact details. At most one reminder per conversation every 30 minutes.', '由你主動選擇接收。提醒只包含安全的站內連結，不包含私訊正文或聯絡資料。同一對話每30分鐘最多提醒一次。')}</p>
    {error && <p role="alert" className="me-notify__error">{errorText}</p>}
    {notice && <p role="status" className="me-notify__status">{noticeText}</p>}
    {!settings ? <button type="button" onClick={() => setRetry(value => value + 1)} className="me-notify__retry">{error ? text('重试加载', 'Retry loading', '重試載入') : text('正在加载通知设置…', 'Loading notification settings…', '正在載入通知設定…')}</button> : <>
      {!settings.deliveryEnabled && <p className="me-notify__warning">{text('发送服务暂未启用；你仍可保存偏好。', 'Delivery is not enabled yet. You can still save your preferences.', '發送服務暫未啟用；你仍可儲存偏好。')}</p>}
      {canEnableAll && <div className="me-notify__all">
        <p>{text('一次开启私信、联系请求等全部提醒，只发到已验证的邮箱或手机。', 'Turn on every reminder at once, sent only to your verified email or phone.', '一次開啟私訊、聯絡請求等全部提醒，只發到已驗證的信箱或手機。')}</p>
        <button type="button" disabled={busy} onClick={() => void submit('all')}>{text('开启全部提醒', 'Turn on all reminders', '開啟全部提醒')}</button>
      </div>}
      <div className="me-notify__channels">{channels.map(channel => {
        const verified = channel === 'email' ? settings.emailVerified : settings.phoneVerified;
        return <fieldset key={channel} disabled={busy}>
          <legend>{channel === 'email' ? text('邮件提醒', 'Email reminders', '郵件提醒') : text('短信提醒', 'SMS reminders', '簡訊提醒')}</legend>
          <p>{verified ? text('已验证', 'Verified', '已驗證') : channel === 'email' ? text('请先验证当前邮箱', 'Verify your current email first', '請先驗證目前信箱') : text('请先在个人资料中验证当前手机号', 'Verify your current phone in your profile first', '請先在個人資料中驗證目前手機號碼')}</p>
          {settings.topics.map(topic => <label key={topic}><input type="checkbox" disabled={!verified || busy} checked={settings.preferences[channel][topic]}
            onChange={event => setSettings(previous => previous ? { ...previous, preferences: { ...previous.preferences, [channel]: { ...previous.preferences[channel], [topic]: event.target.checked } } } : previous)} />
            <span>{topicLabel(topic)}</span>
          </label>)}
          {channel === 'email' && !verified && <button type="button" disabled={busy} onClick={() => void submit('verify')}>{text('发送验证邮件', 'Request verification email', '發送驗證郵件')}</button>}
        </fieldset>;
      })}</div>
      <button type="button" className="me-notify__save" disabled={busy} onClick={() => void submit()}>{busy ? text('正在保存…', 'Saving…', '正在儲存…') : text('保存通知偏好', 'Save notification preferences', '儲存通知偏好')}</button>
      <p className="me-notify__hint">{text('随时取消勾选并保存即可退订，也可使用提醒中的退订链接。', 'Turn a switch off and save to unsubscribe, or use the unsubscribe link in a reminder.', '隨時取消勾選並儲存即可退訂，也可使用提醒中的退訂連結。')}</p>
    </>}
  </section>;
}

/** Messages page prompt: null while unknown or unavailable (never nag on an error), false when every reminder is off. */
export function useAnyReminderOn(userId: string | undefined): boolean | null {
  const [state, setState] = useState<{ owner?: string; on: boolean | null }>({ on: null });
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    api.request('/notifications/preferences', { signal: controller.signal }).then(value => {
      if (controller.signal.aborted || getStoredUser()?.id !== userId) return;
      const settings = normalize(value);
      setState({ owner: userId, on: channels.some(channel => settings.topics.some(topic => settings.preferences[channel][topic])) });
    }).catch(() => { /* Unknown: no prompt. */ });
    return () => controller.abort();
  }, [userId]);
  return state.owner === userId ? state.on : null;
}
