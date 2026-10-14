import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import '../../components/ui/ui.css';
import './community.css';
import { Button } from '../../components/ui/Button';
import { useUiCopy } from '../../components/ui/ui-copy';
import { api, getStoredUser } from '../../lib/api';
import { defaultsState, normalize, preferencePayload, verificationBody, type NotificationSettings } from '../profile/notification-settings';

/**
 * FC3-05 (web side): right after a member's post is published, or after they send a message, offer the off-site
 * reminder for the two events that matter to a trade — 新的私信 and 新的联系请求 — through the existing preferences API
 * (GET / PATCH /notifications/preferences, POST /notifications/email/start). Nothing changes until the member taps;
 * the server's defaults are untouched. Shown only while both reminders are off on every channel and the member has not
 * said 以后再说 (remembered per account in this browser); nothing is shown when the settings cannot be read.
 * H14 (web part): the person who receives a first message or a contact request gets the same offer ('received'), and while
 * the server's preset is on (defaultsActive) the copy says that confirming the email turns these two reminders on by itself.
 */
const dismissKey = (userId: string) => `baylink.notice-optin.dismissed.v1.${encodeURIComponent(userId)}`;
const readDismissed = (userId: string) => { try { return window.localStorage.getItem(dismissKey(userId)) === '1'; } catch { return false; } };
const TRADE_TOPICS = ['message', 'contact_request'] as const;
/** The API's own test (startEmailVerification): an account without a usable address cannot verify one. */
const USABLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type State = { kind: 'loading' } | { kind: 'hidden' } | { kind: 'offer'; settings: NotificationSettings } | { kind: 'busy'; settings: NotificationSettings }
  | { kind: 'on'; delivery: boolean } | { kind: 'verify-sent'; delivery: boolean; defaults: boolean } | { kind: 'error'; settings: NotificationSettings }
  | { kind: 'no-email' };

/** `onShown` runs once, when the offer first appears (a chat scrolls it into view, as it does a new message). */
export function NoticeOptIn({ userId, context, onShown }: { userId: string; context: 'post' | 'dm' | 'received'; onShown?: () => void }) {
  const { t, locale } = useUiCopy();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const shownOnce = useRef(false);
  const offered = state.kind === 'offer';
  useEffect(() => {
    if (!offered || shownOnce.current) return;
    shownOnce.current = true;
    onShown?.();
  }, [offered, onShown]);
  useEffect(() => {
    // Not this browser's signed-in account (a stale view) or 以后再说 already said: no offer and no settings read.
    if (readDismissed(userId) || getStoredUser()?.id !== userId) { setState({ kind: 'hidden' }); return; }
    const controller = new AbortController();
    api.request('/notifications/preferences', { signal: controller.signal }).then(value => {
      if (controller.signal.aborted || getStoredUser()?.id !== userId) return;
      const settings = normalize(value);
      const anyOn = (['email', 'sms'] as const).some(channel => TRADE_TOPICS.some(topic => settings.preferences[channel][topic]));
      // No offer the member cannot take: an unverified account without a usable email address (a phone sign-up).
      const canVerify = settings.emailVerified || USABLE_EMAIL.test(getStoredUser()?.email || '');
      setState(anyOn || !canVerify ? { kind: 'hidden' } : { kind: 'offer', settings });
    }).catch(() => { if (!controller.signal.aborted) setState({ kind: 'hidden' }); });
    return () => controller.abort();
  }, [userId]);

  if (state.kind === 'loading' || state.kind === 'hidden') return null;
  const dismiss = () => {
    try { window.localStorage.setItem(dismissKey(userId), '1'); } catch { /* It is offered again next time. */ }
    setState({ kind: 'hidden' });
  };
  const turnOn = async (settings: NotificationSettings) => {
    setState({ kind: 'busy', settings });
    try {
      // The API turns email reminders on only for a verified address (409 NOTIFICATION_VERIFICATION_REQUIRED), so an
      // unverified member's tap sends the check email first; the reminders are switched on after the link is opened.
      if (!settings.emailVerified) {
        const value = await api.request('/notifications/email/start', { method: 'POST', body: verificationBody(locale) });
        const response = normalize(value);
        if (response.emailVerified) return turnOn(response);
        setState({ kind: 'verify-sent', delivery: (value as { emailDeliveryAvailable?: boolean })?.emailDeliveryAvailable === true, defaults: defaultsState(response) === 'pending' });
        return;
      }
      const draft: NotificationSettings = { ...settings, preferences: { ...settings.preferences, email: { ...settings.preferences.email, message: true, contact_request: true } } };
      const value = await api.request('/notifications/preferences', { method: 'PATCH', body: JSON.stringify({ preferences: preferencePayload(draft), locale }) });
      setState({ kind: 'on', delivery: normalize(value).deliveryEnabled });
    } catch (error) {
      // 403: the server has no usable address for this account (the stored copy was out of date).
      setState((error as { status?: number })?.status === 403 ? { kind: 'no-email' } : { kind: 'error', settings });
    }
  };
  const lead = context === 'post'
    ? t('有人私信你、或请求你的联系方式时，要不要用邮件提醒你？', 'Get an email when someone messages you or asks for your contact details?')
    : context === 'received' ? t('下次有人私信你、或请求你的联系方式时，要不要用邮件提醒你？', 'Get an email the next time someone messages you or asks for your contact details?')
      : t('对方回复时，要不要用邮件提醒你？', 'Get an email when they reply?');
  // While the server's preset is on, confirming the email is what turns these two reminders on (api #44).
  const byDefault = state.kind !== 'on' && state.kind !== 'verify-sent' && state.kind !== 'no-email' && defaultsState(state.settings) === 'pending';
  return <section className="cm-optin" aria-label={t('站外提醒', 'Email reminders')}>
    <BellRing aria-hidden="true" strokeWidth={1.75} className="cm-optin__icon" />
    <div className="cm-optin__body">
      {state.kind === 'on' ? <p role="status">{state.delivery ? t('已开启邮件提醒：新的私信和联系请求。可在「我的 › 通知」随时更改。', 'Email reminders are on for new messages and contact requests. Change them any time in Me › Notifications.')
        : t('已保存。邮件发送服务启用后，新的私信和联系请求会提醒你。', 'Saved. Once email delivery is switched on, you will hear about new messages and contact requests.')}</p>
        : state.kind === 'no-email' ? <p role="status">{t('这个账号还没有可用的邮箱，暂时不能开启邮件提醒。可以到「我的 › 通知」查看其他提醒方式。', 'This account has no email address we can use yet, so email reminders can’t be turned on. See Me › Notifications for other options.')}</p>
        : state.kind === 'verify-sent' ? <p role="status">{state.delivery ? state.defaults ? t('验证邮件已发送。点开邮件里的链接确认后，新的私信和联系请求就会用邮件提醒你；可在「我的 › 通知」关闭。', 'Verification email sent. Once you confirm the link in it, new messages and contact requests are emailed to you; you can turn that off in Me › Notifications.')
          : t('验证邮件已发送。点开邮件里的链接确认后，到「我的 › 通知」开启提醒。', 'Verification email sent. Confirm the link in it, then turn reminders on in Me › Notifications.')
          : t('已记下验证请求；邮件发送暂未启用，稍后可在「我的 › 通知」再试。', 'Your request is saved; email delivery is not switched on yet. Try again later in Me › Notifications.')}</p>
          : <>
            <p>{lead}</p>
            <p className="cm-optin__fine">{t('提醒只含站内链接，不含私信内容或联系方式。', 'Reminders carry a site link only, never message text or contact details.')}{!state.settings.emailVerified && (byDefault ? t(' 需要先验证邮箱：我们会发一封验证邮件，确认后这两类提醒就会开启，可随时关闭。', ' First we email you a link to confirm your address; once you confirm, these two reminders are on, and you can turn them off any time.')
              : t(' 需要先验证邮箱：我们会发一封验证邮件，确认后再开启提醒。', ' First we email you a link to confirm your address; reminders can be turned on after that.'))}</p>
            {state.kind === 'error' && <p role="alert" className="cm-optin__error">{t('没能保存，请稍后再试，或到「我的 › 通知」设置。', 'That didn’t save. Try again later, or use Me › Notifications.')}</p>}
            <div className="cm-optin__actions">
              <Button variant="primary" disabled={state.kind === 'busy'} onClick={() => void turnOn(state.settings)}>{state.settings.emailVerified ? t('用邮件提醒我', 'Email me') : t('先验证邮箱', 'Verify my email first')}</Button>
              <Button variant="text" onClick={dismiss}>{t('以后再说', 'Not now')}</Button>
            </div>
          </>}
      {(state.kind === 'on' || state.kind === 'verify-sent' || state.kind === 'no-email') && <Link className="cm-optin__link" to="/me?view=notifications">{t('查看通知设置', 'Notification settings')}</Link>}
    </div>
  </section>;
}
