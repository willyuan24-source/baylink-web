import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CalendarCheck2, CalendarClock, RefreshCw, Wrench } from 'lucide-react';
import type { UserData } from '../../lib/types';
import type { SavedPlan } from '../../lib/planner';
import { outings, type Outing } from '../../lib/outings';
import { serviceBookings, type ServiceBookingInbox } from '../../lib/service-bookings';
import { useBookingCopy } from './booking-copy';
import { bookingError, bookingSessionKey, useBookingSession } from './booking-session';
import { BookingStatusLabel } from './booking-shared';
import { bookingConflicts, myBookingNeedsReply, selectMyWeekBookings } from './my-week-bookings-model';

type Props = { user: UserData | null; onLoginNeeded: () => void; plans: SavedPlan[]; plansReady: boolean };
export function MyWeekBookings(props: Props) { return <MyWeekBookingsSession key={bookingSessionKey(props.user)} {...props} />; }
function MyWeekBookingsSession({ user, onLoginNeeded, plans, plansReady }: Props) {
  const { t } = useBookingCopy(), session = useBookingSession(user), userId = user?.id;
  const [data, setData] = useState<ServiceBookingInbox | null>(null), [groups, setGroups] = useState<Outing[]>([]);
  const [loading, setLoading] = useState(!!user), [error, setError] = useState(''), [groupsReady, setGroupsReady] = useState(false);
  const [now, setNow] = useState(() => Date.now()); const version = useRef(0);
  const load = useCallback(async () => {
    if (!userId || !session.current()) return;
    const serial = ++version.current, controller = session.controller(); setLoading(true); setError(''); setData(null); setGroups([]); setGroupsReady(false);
    const [bookingsResult, outingsResult] = await Promise.allSettled([serviceBookings.inbox(controller.signal), outings.mine(controller.signal)]);
    session.release(controller);
    if (!session.current() || controller.signal.aborted || serial !== version.current) return;
    if (bookingsResult.status === 'fulfilled' && !bookingsResult.value.asCustomer.some(row => row.customerId !== userId) && !bookingsResult.value.asProvider.some(row => row.providerId !== userId)) setData(bookingsResult.value);
    else setError(bookingError(bookingsResult.status === 'rejected' ? bookingsResult.reason : null, t, 'read'));
    if (outingsResult.status === 'fulfilled' && !outingsResult.value.outings.some(row => row.me && row.me.userId !== userId || row.host.id !== userId && !row.me)) { setGroups(outingsResult.value.outings); setGroupsReady(true); }
    setLoading(false); setNow(Date.now());
  }, [session, userId, t]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const selection = data && userId ? selectMyWeekBookings(data, userId, now) : null;
  return <section className="week-bookings" aria-label={t('我的预约与待办', 'My appointments and replies')}>
    <header className="week-bookings-heading"><div><span className="planner-eyebrow">{t('把生活里的需要也安排好', 'MAKE ROOM FOR EVERYDAY LIFE')}</span><h2><CalendarCheck2 size={22} aria-hidden="true" />{t('预约与待办', 'Appointments & replies')}</h2></div><Link to="/me/bookings">{t('全部预约', 'All bookings')} <ChevronRight size={16} aria-hidden="true" /></Link></header>
    {!user ? <div className="week-bookings-empty"><CalendarClock size={28} aria-hidden="true" /><p>{t('登录后，查看你预约的服务、收到的申请和待回应的改期。', 'Sign in to see your appointments, incoming requests and reschedule proposals.')}</p><button type="button" onClick={onLoginNeeded}>{t('登录查看预约', 'Sign in to see appointments')}</button></div> : <>
      <div className="week-bookings-toolbar"><p>{selection?.needsReply.length ? t(`有 ${selection.needsReply.length} 份安排等你回应`, `${selection.needsReply.length} arrangements need your reply`) : t('未来7天的预约，以及更晚日期的待确认事项。', 'Appointments in the next 7 days, plus pending requests for later dates.')}</p><button type="button" disabled={loading} onClick={() => void load()}><RefreshCw size={14} aria-hidden="true" />{t('刷新预约', 'Refresh appointments')}</button></div>
      {loading && <p role="status">{t('正在核对预约与安排…', 'Checking appointments and plans…')}</p>}
      {error && <p className="week-bookings-warning" role="alert">{error}</p>}
      {selection && <>
        {!selection.visible.length && <div className="week-bookings-empty"><Wrench size={25} aria-hidden="true" /><p>{t('这周暂无服务预约，也没有待确认申请。', 'No service appointments this week or pending requests.')}</p><Link to="/category/service">{t('看看社区服务', 'Explore local services')} </Link></div>}
        <div className="week-bookings-grid">{selection.visible.map(booking => {
          const provider = booking.providerId === user.id, reply = myBookingNeedsReply(booking, user.id, now);
          const conflicts = bookingConflicts(booking, selection.all, plansReady ? plans : [], groups, user.id);
          const pendingReschedule = booking.reschedule?.status === 'pending' && booking.reschedule.expiresAt > now;
          return <article key={`${booking.providerId}:${booking.id}`} className={`week-booking-card${reply ? ' needs-reply' : ''}`}>
            <div className="week-booking-date" aria-hidden="true"><span>{booking.date.slice(0, 7)}</span><strong>{booking.date.slice(8)}</strong><Wrench size={18} /></div>
            <div className="week-booking-body"><div className="week-booking-badges"><BookingStatusLabel booking={booking} now={now} t={t} />{reply && <span>{t('等你回应', 'Your reply needed')}</span>}</div>
              <h3 translate="no">{booking.postTitle}</h3><p>{provider ? t('我提供服务', 'I provide the service') : t('我预约的服务', 'My appointment')}</p>
              <time dateTime={new Date(booking.startAt).toISOString()}>{booking.date} · {booking.startTime}–{booking.endTime}</time>
              {pendingReschedule && <p className="week-booking-proposal">{t('提议改为', 'Proposed')} {booking.reschedule!.date} · {booking.reschedule!.startTime}–{booking.reschedule!.endTime}<br />{t('原预约保留，等双方确认。', 'Original time retained until both agree.')}</p>}
              {conflicts.length > 0 && <div className="week-bookings-warning"><strong>{t('时间重叠，请核对', 'Overlapping times · please review')}</strong><ul>{conflicts.map(conflict => <li key={conflict.id}><Link to={conflict.href}>{conflict.title}</Link></li>)}</ul></div>}
              <Link className="week-booking-action" to={`/me/bookings?view=${provider ? 'received' : 'mine'}#booking-${booking.id}`}>{reply ? t('查看并回应', 'Review and reply') : t('查看预约 / 协商改期', 'View / reschedule')} <ChevronRight size={15} aria-hidden="true" /></Link>
            </div>
          </article>;
        })}</div>
        {selection.visible.length > 0 && <p className="week-bookings-note">{t('湾区时间。重叠提示仅比较当前账号已确认的预约、小队与已保存计划，不含交通时间，也不会自动改动安排。', 'Bay Area time. Overlap checks compare your confirmed appointments, groups and saved plans. Travel time is excluded and nothing is changed automatically.')}{(!groupsReady || !plansReady) && <> {t('部分计划或小队未能读取，冲突检查尚不完整。', 'Some plans or groups could not be loaded; overlap checks are incomplete.')}</>}</p>}
      </>}
    </>}
  </section>;
}
