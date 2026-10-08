import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { bookingDisplayStatus, serviceBookings, type BookingAction, type BookingRescheduleAction, type ServiceBooking, type ServiceBookingInbox } from '../../lib/service-bookings';
import type { UserData } from '../../lib/types';
import { useBookingCopy } from './booking-copy';
import { BookingError, BookingNotice, BookingNotificationNotice, BookingStatusLabel } from './booking-shared';
import { bookingError, bookingSessionKey, useBookingSession, type BookingToast } from './booking-session';
import { BookingReschedulePanel } from './BookingReschedulePanel';
import './bookings.css';
import { EnglishOnly } from '../../components/EnglishOnly';

export type ServiceBookingsDashboardProps = { user: UserData | null; onLoginNeeded: () => void; showToast: BookingToast };
function DashboardSession({ user, onLoginNeeded, showToast }: ServiceBookingsDashboardProps) {
  const { t, locale } = useBookingCopy(), session = useBookingSession(user);
  const [data, setData] = useState<ServiceBookingInbox | null>(null), [loading, setLoading] = useState(!!user), [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [initialTab, setInitialTab] = useState<'customer' | 'provider' | null>(null);
  const tab = params.get('view') === 'received' ? 'provider' : params.has('view') ? 'customer' : initialTab || 'customer';
  const setTab = (next: 'customer' | 'provider') => setParams(current => { const updated = new URLSearchParams(current); updated.set('view', next === 'provider' ? 'received' : 'mine'); return updated; }, { replace: true });
  const [busy, setBusy] = useState('');
  const [confirmation, setConfirmation] = useState<{ id: string; action: 'cancel' | 'decline' } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const readVersion = useRef(0), mutationLock = useRef(false);
  const load = useCallback(async () => {
    if (!user) return;
    const version = ++readVersion.current, controller = session.controller(); setLoading(true);
    try {
      const response = await serviceBookings.inbox(controller.signal);
      if (response.asCustomer.some(booking => booking.customerId !== user.id) || response.asProvider.some(booking => booking.providerId !== user.id)) throw new Error('Unexpected booking account');
      if (session.current() && !controller.signal.aborted && version === readVersion.current) {
        setInitialTab(previous => previous ?? (response.asProvider.length > 0 && response.asCustomer.length === 0 ? 'provider' : 'customer'));
        setData(response); setError('');
      }
    } catch (reason) { if (session.current() && !controller.signal.aborted && version === readVersion.current) setError(bookingError(reason, t, 'read')); }
    finally { session.release(controller); if (session.current() && version === readVersion.current) setLoading(false); }
  }, [session, t, user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!loading && data && location.hash.startsWith('#booking-')) {
      const target = document.getElementById(location.hash.slice(1));
      target?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    }
  }, [loading, data, location.hash]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const actOnBooking = async (booking: ServiceBooking, action: BookingAction | BookingRescheduleAction) => {
    if (mutationLock.current || !session.current()) return;
    const payload = { providerId: booking.providerId, bookingId: booking.id, action }, key = session.key(payload), controller = session.controller();
    mutationLock.current = true; ++readVersion.current; setBusy(booking.id); setError('');
    try {
      const response = typeof action === 'string' ? await serviceBookings.action(booking, action, key, controller.signal) : await serviceBookings.reschedule(booking, action, key, controller.signal);
      if (!session.current()) return;
      const updated = { ...response.booking, notifications: response.notifications };
      setData(previous => previous && { ...previous, asCustomer: previous.asCustomer.map(item => item.id === booking.id ? updated : item), asProvider: previous.asProvider.map(item => item.id === booking.id ? updated : item) });
      setConfirmation(null); session.clearKey(payload); showToast(typeof action !== 'string' && action.action === 'propose' ? t('改期提议已发送，原预约继续保留。', 'Proposal sent. Your original booking remains confirmed.') : t('预约状态已更新。', 'Booking status updated.'), 'success');
    } catch (reason) { if (session.current()) setError(bookingError(reason, t)); }
    finally { session.release(controller); if (session.current()) { mutationLock.current = false; setBusy(''); setLoading(false); } }
  };
  const setSms = async (enabled: boolean) => {
    if (mutationLock.current || !session.current()) return;
    const controller = session.controller(); mutationLock.current = true; ++readVersion.current; setBusy('sms'); setError('');
    try {
      const sms = await serviceBookings.sms(enabled, controller.signal);
      if (!session.current()) return;
      if (sms.enabled !== enabled || (enabled && (!sms.eligible || !sms.configured))) throw new Error('SMS setting not confirmed');
      setData(previous => previous && { ...previous, sms }); showToast(enabled ? t('预约短信提醒已开启。', 'Booking SMS alerts enabled.') : t('预约短信提醒已关闭。', 'Booking SMS alerts disabled.'), 'success');
    } catch (reason) { if (session.current()) setError(bookingError(reason, t)); }
    finally { session.release(controller); if (session.current()) { mutationLock.current = false; setBusy(''); setLoading(false); } }
  };
  const dateTime = (timestamp: number) => new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp);
  const rows = data ? (tab === 'customer' ? data.asCustomer : data.asProvider).slice().sort((a, b) => {
    const active = (value: ServiceBooking) => ['pending', 'confirmed'].includes(bookingDisplayStatus(value, now)) ? 0 : 1;
    return active(a) - active(b) || (active(a) ? b.updatedAt - a.updatedAt : a.startAt - b.startAt);
  }) : [];
  return <section className="service-bookings-dashboard" translate="no" aria-label={t('我的服务预约', 'My service bookings')}>
    <Link to="/me" className="booking-back"><ArrowLeft size={16} aria-hidden="true" />{t('我的 BAYLINK', 'My BAYLINK')}</Link>
    <header className="booking-dashboard-heading"><div><EnglishOnly><span className="booking-eyebrow">A LITTLE TIME, WELL PLANNED</span></EnglishOnly><h1>{t('把需要，安排妥当', 'Make time for what you need')}</h1><p>{t('约时间、看进度，与邻居把服务细节说清楚。', 'Book a time, follow its progress and agree on the details together.')}</p></div><span className="booking-dashboard-art" aria-hidden="true"><CalendarDays size={37} strokeWidth={1.4} /></span></header>
    {!user ? <section className="booking-surface booking-guest"><h2>{t('登录后管理你的预约', 'Sign in to manage your bookings')}</h2><p>{t('预约记录属于你的账号，只会向预约双方展示。', 'Booking records belong to your account and are only shown to the participants.')}</p><button className="booking-primary" type="button" onClick={onLoginNeeded}>{t('登录 / 注册', 'Sign in / Register')}</button></section> : <>
      <div className="booking-dashboard-toolbar"><div className="booking-tabs" role="group" aria-label={t('预约方向', 'Booking view')}><button type="button" aria-pressed={tab === 'customer'} onClick={() => { setTab('customer'); setConfirmation(null); }}>{t('我预约的', 'My bookings')}{data && <span>{data.asCustomer.length}</span>}</button><button type="button" aria-pressed={tab === 'provider'} onClick={() => { setTab('provider'); setConfirmation(null); }}>{t('我收到的', 'Received')}{data && <span>{data.asProvider.length}</span>}</button></div><button className="booking-icon-button" aria-label={t('刷新预约记录', 'Refresh bookings')} disabled={!!busy || loading} type="button" onClick={() => void load()}><RefreshCw size={17} aria-hidden="true" /></button></div>
      {loading && <p role="status">{t('正在读取预约记录…', 'Loading bookings…')}</p>}{error && <BookingError message={error} onRetry={() => void load()} retryLabel={t('刷新预约状态', 'Refresh booking status')} disabled={!!busy || loading} />}
      {data && !rows.length && <section className="booking-empty booking-surface"><CalendarDays size={26} aria-hidden="true" /><h2>{tab === 'customer' ? t('还没有预约', 'No bookings yet') : t('还没有收到预约', 'No booking requests yet')}</h2><p>{tab === 'customer' ? t('从服务帖选择可约时间，提交后在这里查看进度。', 'Choose an available time on a service listing, then track it here.') : t('在你已发布的服务帖里设置可约时段，邻居就能发来申请。', 'Set available times on your existing service listings to receive requests.')}</p><Link className="booking-secondary" to="/category/service">{t('浏览社区服务', 'Browse community services')}</Link></section>}
      <div className="booking-records">{rows.map(booking => {
        const status = bookingDisplayStatus(booking, now), provider = booking.providerId === user.id;
        const pending = status === 'pending', confirmed = status === 'confirmed';
        const confirmAction = confirmation?.id === booking.id ? confirmation.action : null;
        return <article id={`booking-${booking.id}`} className="booking-record booking-surface" key={booking.id} aria-label={booking.postTitle} aria-busy={busy === booking.id}>
          <div className="booking-record-top"><BookingStatusLabel booking={booking} t={t} now={now} /><span>{provider ? t('来自', 'From') : t('服务者', 'Provider')} · {provider ? booking.customerName || t('预约用户', 'Customer') : booking.providerName || t('服务发布者', 'Provider')}</span></div>
          <h2><Link to={`/posts/${encodeURIComponent(booking.postId)}`}>{booking.postTitle}</Link></h2><p className="booking-record-time"><CalendarDays size={17} aria-hidden="true" /><time dateTime={booking.date}>{booking.date}</time> <strong>{booking.startTime}–{booking.endTime}</strong></p><p className="booking-footnote">{t('湾区时间 · America/Los_Angeles', 'Bay Area time · America/Los_Angeles')}</p>
          {booking.note && <p className="booking-record-note">{booking.note}</p>}
          {booking.notifications && (booking.notifications.inApp !== 'sent' || ['failed', 'unknown', 'pending', 'unconfigured'].includes(booking.notifications.sms)) && <BookingNotificationNotice notifications={booking.notifications} conversationId={booking.conversationId} t={t} />}
          {pending && <p className="booking-deadline">{t('待确认申请，不代表预约成功。服务者需在', 'A request is not a confirmed booking. The provider must respond before')} <time dateTime={new Date(Math.min(booking.expiresAt ?? booking.startAt, booking.startAt)).toISOString()}>{dateTime(Math.min(booking.expiresAt ?? booking.startAt, booking.startAt))}</time> {t('前答复，逾期自动释放时段。', '; the time is released if the request expires.')}</p>}
          {confirmed && booking.endAt <= now && <p className="booking-footnote">{t('预约时间已过，完成状态仍需服务者确认。', 'The appointment time has passed. The provider still needs to mark completion.')}</p>}
          <BookingReschedulePanel key={`${booking.id}:${booking.reschedule?.id || ''}:${booking.reschedule?.status || ''}`} booking={booking} user={user} now={now} disabled={!!busy || loading} onAction={action => void actOnBooking(booking, action)} />
          <div className="booking-record-actions">
            {provider && pending && <button type="button" className="booking-primary" disabled={!!busy || loading} onClick={() => void actOnBooking(booking, 'confirm')}>{t('接受预约', 'Accept booking')}</button>}
            {provider && pending && <button type="button" className="booking-secondary" disabled={!!busy || loading} onClick={() => setConfirmation({ id: booking.id, action: 'decline' })}>{t('婉拒申请', 'Decline request')}</button>}
            {(pending || confirmed) && <button type="button" className="booking-text" disabled={!!busy || loading} onClick={() => setConfirmation({ id: booking.id, action: 'cancel' })}>{t('取消预约', 'Cancel booking')}</button>}
            {provider && confirmed && booking.endAt <= now && <button type="button" className="booking-secondary" disabled={!!busy || loading} onClick={() => void actOnBooking(booking, 'complete')}>{t('标记已完成', 'Mark completed')}</button>}
            <Link className="booking-text" to={booking.conversationId ? `/messages/${encodeURIComponent(booking.conversationId)}` : '/messages'}><MessageCircle size={16} aria-hidden="true" />{t('站内消息', 'Messages')}</Link>
          </div>
          {confirmAction && <div className="booking-confirm-action" role="group" aria-label={t('确认预约变更', 'Confirm booking change')}><p>{confirmAction === 'cancel' ? t('取消后会释放这个时段。确定取消吗？', 'Cancelling releases this time. Cancel the booking?') : t('婉拒后会释放这个时段，并更新申请状态。', 'Declining releases this time and updates the request.')}</p><button className="booking-secondary" disabled={!!busy || loading} type="button" onClick={() => void actOnBooking(booking, confirmAction)}>{confirmAction === 'cancel' ? t('确定取消', 'Yes, cancel') : t('确定婉拒', 'Yes, decline')}</button><button className="booking-text" disabled={!!busy} type="button" onClick={() => setConfirmation(null)}>{t('保留预约', 'Keep booking')}</button></div>}
        </article>;
      })}</div>
      {data && tab === 'provider' && <section className="booking-sms booking-surface"><div className="booking-sms-heading"><ShieldCheck size={20} aria-hidden="true" /><h2>{t('服务者短信提醒', 'Provider SMS alerts')}</h2></div><label className="booking-check"><input type="checkbox" checked={data.sms.enabled} disabled={!!busy || loading || (!data.sms.enabled && (!data.sms.configured || !data.sms.eligible))} onChange={event => void setSms(event.target.checked)} />{t('同意接收预约相关短信（可随时关闭）', 'Receive booking-related text messages (turn off anytime)')}</label>
        <p className="booking-footnote">{t('默认关闭，与登录验证码授权分开。仅发送预约事务提醒，不发送营销内容；短信与流量费用可能适用。', 'Off by default and separate from verification-code consent. Booking alerts only, no marketing. Message and data rates may apply.')} <Link to="/sms-consent">{t('短信说明', 'SMS details')}</Link></p>
        {!data.sms.eligible && <p>{t('需要先验证账号手机号。', 'Verify your account phone number first.')} <Link to="/me">{t('前往个人主页验证', 'Go to profile to verify')}</Link></p>}
        {!data.sms.configured && <p className="booking-configuration-note">{t('当前环境未启用预约短信。预约和站内消息仍可使用。', 'Booking SMS is not configured in this environment. Bookings and in-app messages remain available.')}</p>}
      </section>}
    </>}
    <BookingNotice t={t} />
  </section>;
}
export function ServiceBookingsDashboard(props: ServiceBookingsDashboardProps) { return <DashboardSession key={bookingSessionKey(props.user)} {...props} />; }
