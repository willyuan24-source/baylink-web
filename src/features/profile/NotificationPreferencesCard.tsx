import { useEffect, useRef, useState } from 'react';
import { api, getStoredUser } from '../../lib/api';
import { useLocale } from '../../i18n/locale';
import { allRemindersOn, channels, defaultEmailTopics, defaultsState, normalize, preferencePayload, record, verificationBody, verifiedChannels, type NotificationSettings, type Topic } from './notification-settings';

type RequestSession = { cancelled: boolean; request: AbortController | null; locked: boolean };
type RequestError = { kind: 'load' | 'save'; message?: string };
type Notice = '' | 'saved' | 'verified' | 'queued' | 'delivery_disabled' | 'all_on';
const serverError = (value: unknown): string | undefined => {
  const message = record(value).error;
  return typeof message === 'string' && message.length > 0 && message.length <= 512 ? message : undefined;
};

/**
 * Opt-in is an explicit authenticated save, except the server's H14 preset (api #44): while `defaultsActive`, a verified
 * email gets 新的私信 and 新的联系请求 once, for an account that never chose. The lead sentence says which of the four
 * states this account is in (defaultsState) and, only while verifying would still turn them on ('pending'), the email
 * switches mark the preset; nothing here claims a default the server does not report. Once a channel is
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
        body: mode === 'verify' ? verificationBody(locale) : JSON.stringify({ preferences: preferencePayload(draft), locale }),
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
  const topicLabel = (topic: Topic) => topic === 'message' ? text('新的私信', 'New private messages', '新的私訊')
    : topic === 'contact_request' ? text('新的联系请求', 'New contact requests', '新的聯絡請求')
      : topic === 'outing_request' ? text('新的小队申请', 'New team applications', '新的小隊申請')
        : text('我的帖子有新评论', 'New comments on my posts', '我的帖子有新留言');
  const canEnableAll = !!settings && verifiedChannels(settings).length > 0 && !allRemindersOn(settings);
  // 「新的私信」「新的联系请求」 / "new private messages and new contact requests": the server's preset, in the switches' words.
  function defaultNames(language: 'zh' | 'en') {
    const names = settings ? defaultEmailTopics(settings).map(topic => language === 'en' ? topicLabel(topic).toLowerCase() : `「${topicLabel(topic)}」`) : [];
    return language === 'en' ? names.join(' and ') : names.join('');
  }
  const state = settings ? defaultsState(settings) : 'off';
  // While the preferences load (or failed to), a neutral lead: no state is claimed before the server reports one (WEB-FIX6).
  const lead = !settings ? text('站外提醒发到你验证过的邮箱或手机。', 'Reminders go to the email or phone you have verified.', '站外提醒發到你驗證過的信箱或手機。')
    : state === 'pending' ? text(`验证邮箱后，${defaultNames('zh')}会默认用邮件提醒你，可随时关闭。`, `Once your email is verified, ${defaultNames('en')} are emailed to you by default. You can turn them off any time.`, `驗證信箱後，${defaultNames('zh')}會預設用郵件提醒你，可隨時關閉。`)
    // True for an account defaulted when it verified and for one migrated on read (verified long before), preset on or off.
    : state === 'applied' ? text(`已按默认为你开启${defaultNames('zh')}邮件提醒，可随时关闭。`, `${defaultNames('en').replace(/^./, first => first.toUpperCase())} are on for email by default. You can turn them off any time.`, `已按預設為你開啟${defaultNames('zh')}郵件提醒，可隨時關閉。`)
      : state === 'chosen' ? text('按你保存的选择接收，可随时更改。', 'You get the reminders you chose, and can change them any time.', '按你儲存的選擇接收，可隨時更改。')
        : text('由你主动选择接收。', 'Choose which reminders to receive.', '由你主動選擇接收。');
  const noticeText = notice === 'verified' ? text('邮箱已验证。', 'Email already verified.', '信箱已驗證。')
    : notice === 'queued' ? text('验证请求已排队，请查收邮件并在30分钟内确认。', 'Verification is queued. Check your email and confirm within 30 minutes.', '驗證請求已排隊，請查收郵件並在30分鐘內確認。')
      + (settings && defaultsState(settings) === 'pending' ? text(`确认后，${defaultNames('zh')}邮件提醒会默认开启。`, ` Once you confirm, ${defaultNames('en')} are emailed to you by default.`, `確認後，${defaultNames('zh')}郵件提醒會預設開啟。`) : '')
      : notice === 'delivery_disabled' ? text('验证请求已保存；邮件发送暂未启用，请稍后重新请求。', 'The request was saved. Email delivery is not enabled yet; request a new link later.', '驗證請求已儲存；郵件發送暫未啟用，請稍後重新請求。')
        : notice === 'all_on' ? text('已开启全部提醒。随时可以取消勾选并保存。', 'All reminders are on. You can turn any of them off and save.', '已開啟全部提醒。隨時可以取消勾選並儲存。')
          : text('通知偏好已保存。', 'Notification preferences saved.', '通知偏好已儲存。');
  return <section className="me-notify" aria-labelledby="notification-settings-title">
    <h2 id="notification-settings-title">{text('站外通知', 'Email and SMS notifications', '站外通知')}</h2>
    <p>{lead}{text('提醒只包含安全的站内链接，不包含私信正文或联系方式。同一会话每30分钟最多提醒一次。', ' They contain a secure site link, without private message text or contact details. At most one reminder per conversation every 30 minutes.', '提醒只包含安全的站內連結，不包含私訊正文或聯絡資料。同一對話每30分鐘最多提醒一次。')}</p>
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
            <span>{topicLabel(topic)}{channel === 'email' && state === 'pending' && settings.defaults.email[topic] && <small className="me-notify__default">{text('验证后默认开启', 'on by default once verified', '驗證後預設開啟')}</small>}</span>
          </label>)}
          {channel === 'email' && !verified && <button type="button" disabled={busy} onClick={() => void submit('verify')}>{text('发送验证邮件', 'Request verification email', '發送驗證郵件')}</button>}
        </fieldset>;
      })}</div>
      <button type="button" className="me-notify__save" disabled={busy} onClick={() => void submit()}>{busy ? text('正在保存…', 'Saving…', '正在儲存…') : text('保存通知偏好', 'Save notification preferences', '儲存通知偏好')}</button>
      <p className="me-notify__hint">{text('随时取消勾选并保存即可关闭；每封提醒邮件里也有「关闭这类邮件」链接，只关闭那一类提醒。', 'Turn a switch off and save to stop it. Every reminder email also has a “Turn off these emails” link that stops that kind only.', '隨時取消勾選並儲存即可關閉；每封提醒郵件裡也有「關閉這類郵件」連結，只關閉那一類提醒。')}</p>
    </>}
  </section>;
}
