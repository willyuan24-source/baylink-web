import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarDays, MapPin, RefreshCw, Users } from 'lucide-react';
import type { UserData } from '../../lib/types';
import { outings, type Outing } from '../../lib/outings';
import { canExportOutingCalendar, downloadOutingCalendar } from '../../lib/outing-calendar';
import { useOutingCopy, useOutingNow } from './outing-copy';
import { outingError, outingSessionKey, useOutingSession } from './outing-session';
import { selectMyWeekOutings } from './my-week-outings-model';
import { OutingCover } from './OutingCover';

type Props = { user: UserData | null; onLoginNeeded: () => void };
export function MyWeekOutings(props: Props) {
  return <MyWeekOutingsSession key={outingSessionKey(props.user)} {...props} />;
}

function MyWeekOutingsSession({ user, onLoginNeeded }: Props) {
  const { t, locale } = useOutingCopy(), now = useOutingNow(), session = useOutingSession(user);
  const [rows, setRows] = useState<Outing[]>([]), [loading, setLoading] = useState(!!user);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [exporting, setExporting] = useState('');
  const serial = useRef(0), lock = useRef(false);
  const userId = user?.id;
  const load = useCallback(async () => {
    if (!userId || !session.current() || lock.current) return;
    lock.current = true;
    const version = ++serial.current, controller = session.controller();
    setRows([]); setError(''); setNotice(''); setExporting(''); setLoading(true);
    try {
      const response = await outings.mine(controller.signal);
      if (response.outings.some(row => (row.me && row.me.userId !== userId) || (row.host.id !== userId && !row.me))) throw new Error('Unexpected private outing account');
      if (!session.current() || controller.signal.aborted || version !== serial.current) return;
      setRows(response.outings);
    } catch (reason) {
      if (session.current() && !controller.signal.aborted && version === serial.current) { setRows([]); setError(outingError(reason, t, true)); }
    } finally {
      session.release(controller);
      if (session.current() && version === serial.current) { lock.current = false; setLoading(false); }
    }
  }, [session, userId, t]);
  useEffect(() => { const counter = serial; void load(); return () => { ++counter.current; lock.current = false; }; }, [load]);

  const exportCalendar = useCallback(async (row: Outing) => {
    if (!userId || !session.current() || lock.current) return;
    lock.current = true;
    const version = ++serial.current, controller = session.controller();
    setExporting(row.id); setError(''); setNotice('');
    try {
      const { outing: latest } = await outings.get(row.id, controller.signal);
      if (!session.current() || controller.signal.aborted || version !== serial.current) return;
      if (latest.me && latest.me.userId !== userId) throw new Error('Unexpected private outing account');
      setRows(previous => previous.map(item => item.id === row.id ? latest : item));
      if (!canExportOutingCalendar(latest, userId, Date.now())) {
        setNotice(t('安排或你的参加状态已变化。请打开小队查看；尚未下载日历。', 'The plan or your participation changed. Open the outing to review it; no calendar was downloaded.'));
        return;
      }
      if (latest.planVersion !== row.planVersion || latest.startAt !== row.startAt || latest.endAt !== row.endAt) {
        setNotice(t('安排已更新，已刷新卡片。请先核对最新安排，再存入日历。', 'The plan changed and this card is updated. Review it before saving the calendar again.'));
        return;
      }
      downloadOutingCalendar(latest, userId, Date.now(), locale);
      setNotice(t('日历文件已生成，请按浏览器提示保存。不会自动同步；安排变化或取消后，请回站核对并更新日历。', 'Calendar file ready. Follow your browser’s prompt to save it. It does not sync automatically; check BAYLINK and update your calendar after changes or cancellation.'));
    } catch (reason) {
      if (session.current() && !controller.signal.aborted && version === serial.current) {
        setRows([]);
        setError(t('未能核对最新安排，尚未下载日历。请重新读取小队后再试。', 'The latest plan could not be checked. No calendar was downloaded. Reload your outings and try again.') + ' ' + outingError(reason, t, true));
      }
    } finally {
      session.release(controller);
      if (session.current() && version === serial.current) { lock.current = false; setExporting(''); }
    }
  }, [session, userId, t, locale]);
  const { arrangements, requests } = userId ? selectMyWeekOutings(rows, userId, now) : { arrangements: [], requests: [] };
  const link = (row: Outing) => `/together?view=mine&outing=${encodeURIComponent(row.id)}`;
  return <section className="week-outings" aria-label={t('我的小队安排', 'My group plans')}>
    <div className="week-outings-heading"><div><span className="planner-eyebrow">{t('同行，也排进这周', 'MAKE ROOM FOR COMPANY')}</span><h2><Users size={21} aria-hidden="true"/>{t('小队安排 · 未来7天', 'Group plans · next 7 days')}</h2></div><nav aria-label={t('小队快捷入口', 'Group shortcuts')}><Link to="/together?view=mine">{t('全部小队与申请', 'All groups and requests')} ↗</Link><Link to="/together">{t('找同行', 'Find company')} ↗</Link></nav></div>
    <p className="week-outings-help">{t('按湾区当地日期，含今天。', 'Bay Area dates, including today.')}</p>
    {!user ? <div className="week-outings-empty"><p>{t('登录后，在这里查看你发起和已加入的小队。收藏活动不会自动报名。', 'Sign in to see groups you host or joined. Saving an event does not sign you up.')}</p><button type="button" onClick={onLoginNeeded}>{t('登录查看小队', 'Sign in to see groups')}</button></div> : <>
      <div className="week-outings-toolbar"><button type="button" disabled={loading || !!exporting} onClick={() => void load()}><RefreshCw size={14} aria-hidden="true"/>{t('刷新小队安排', 'Refresh group plans')}</button></div>
      {loading && <p role="status">{t('正在读取你的小队…', 'Loading your groups…')}</p>}
      {error && <div className="week-outings-alert" role="alert"><p>{error}</p><button type="button" disabled={loading || !!exporting} onClick={() => void load()}>{t('重新读取小队', 'Reload groups')}</button></div>}
      {notice && <p className="week-outings-notice" role="status">{notice}</p>}
      {!loading && !error && <>
        {!arrangements.length && <div className="week-outings-empty"><p>{t('未来7天还没有你发起或已加入的小队安排。', 'No groups you host or joined are scheduled in the next 7 days.')}</p><Link to="/together">{t('找个搭子一起去', 'Find people to go with')} ↗</Link></div>}
        <div className="week-outings-grid">{arrangements.map(row => {
          const host = row.host.id === userId, reconfirm = !host && row.me?.confirmedVersion !== row.planVersion;
          const voteNeeded = row.me?.status === 'confirmed' && row.status === 'open' && row.startAt > now && row.timePoll?.status === 'open' && !row.timePoll.myAnswers;
          return <article className={`week-outing-card${reconfirm ? ' needs-confirmation' : ''}`} key={row.id}>
            <OutingCover outing={row} to={link(row)} />
            <div className="week-outing-card-body">
            <span className="week-outing-status">{host ? t('我发起的', 'Hosted by me') : reconfirm ? t('安排已变，待重新确认', 'Plan changed — reconfirm') : t('已加入', 'Joined')}</span>
            <h3 translate="no"><Link to={link(row)}>{row.title}</Link></h3>
            <p><CalendarDays size={15} aria-hidden="true"/><time dateTime={new Date(row.startAt).toISOString()}>{row.date} · {row.startTime}–{row.endTime}</time></p>
            <p translate="no"><MapPin size={15} aria-hidden="true"/>{row.city} · {row.venue}</p>
            {reconfirm && <p className="week-outings-help">{t('先查看变更并重新确认，再存入日历。', 'Review the changes and reconfirm before saving a calendar.')}</p>}
            {voteNeeded && <div className="week-outing-attention"><Link to={link(row)}><CalendarClock size={16} aria-hidden="true"/>{t('时间待投票', 'Time vote needed')} ↗</Link><span>{reconfirm ? t('先确认最新安排，再选择可参加的时间。', 'Reconfirm the latest plan before sharing availability.') : t('告诉小队哪些时间适合你；当前安排暂不变。', 'Tell the team what works for you; the current time is unchanged.')}</span></div>}
            <div className="week-outing-actions"><Link to={link(row)}>{reconfirm ? t('查看变更并确认', 'Review and reconfirm') : t('查看安排与讨论', 'Plan and discussion')}</Link><button type="button" disabled={!!exporting || !canExportOutingCalendar(row, userId, now)} onClick={() => void exportCalendar(row)}>{exporting === row.id ? t('正在核对…', 'Checking…') : t('存入日历', 'Save to calendar')}</button></div>
            </div>
          </article>;
        })}</div>
        {requests.length > 0 && <div className="week-outing-requests"><h3>{t('待处理申请 · 尚未加入', 'Pending requests · not joined')}</h3><p className="week-outings-help">{t('包括未来7天以后的申请。发起人接受后才算加入；候补不会自动补位，小队不包含活动门票。', 'Includes requests beyond the next 7 days. You join only after host approval; waitlists do not move automatically and groups do not include event tickets.')}</p><ul>{requests.map(row => <li key={row.id}><div><span className="week-outing-status">{row.me?.waitlisted ? t('候补中，尚未加入', 'Waitlisted, not joined') : t('申请待确认，尚未加入', 'Request pending, not joined')}</span><h4 translate="no"><Link to={link(row)}>{row.title}</Link></h4><time dateTime={row.date}>{row.date} · {row.startTime}–{row.endTime}</time></div><Link to={link(row)}>{t('查看或撤回申请', 'Review or withdraw')} ↗</Link></li>)}</ul></div>}
        {arrangements.length > 0 && <p className="week-outings-help">{t('日历是单次文件，不会自动同步；小队变更或取消后，请回站核对并更新日历。', 'Calendar files are one-time copies and do not sync. Check BAYLINK and update your calendar after changes or cancellation.')}</p>}
      </>}
    </>}
  </section>;
}
