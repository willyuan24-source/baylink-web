import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, MapPin, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import type { AppContextValue } from '../../app/context';
import { MONTHLY_EVENTS } from '../../data/monthly-edition';
import { outings, type Outing, type OutingFilters } from '../../lib/outings';
import { getBayAreaToday, getMonthlyDateRange } from '../../lib/monthly';
import { OutingDetail, memberLabel, outingEligible, outingLabel } from './OutingDetail';
import { emptyOutingDraft, OutingForm } from './OutingForm';
import { useOutingCopy, useOutingNow } from './outing-copy';
import { outingError, outingSessionKey, useOutingSession } from './outing-session';
import './outings.css';

const discoveryKeys = ['q','city','date','dateFrom','dateTo','language','seats','sort','cursor'] as const;
function discoveryFilters(params: URLSearchParams): OutingFilters {
  const date = params.get('date') || '', language = params.get('language');
  return { ...(params.get('event') ? { eventId:params.get('event')! } : {}),
    ...(params.get('q') ? { q:params.get('q')!.trim() } : {}), ...(params.get('city') ? { city:params.get('city')!.trim() } : {}),
    ...(date ? { date } : { ...(params.get('dateFrom') ? { dateFrom:params.get('dateFrom')! } : {}), ...(params.get('dateTo') ? { dateTo:params.get('dateTo')! } : {}) }),
    ...(language === 'zh' || language === 'en' ? { language } : {}), ...(params.get('seats') === 'open' ? { seats:'open' as const } : {}), sort:'soonest' };
}

function DiscoveryFilters({ filters, apply, clear }: { filters: OutingFilters; apply: (value: OutingFilters) => void; clear: () => void }) {
  const { t } = useOutingCopy(), now = useOutingNow();
  const form = useRef<HTMLFormElement>(null);
  const [exactDate,setExactDate] = useState(filters.date || '');
  const [range,setRange] = useState({ from:filters.dateFrom || '',to:filters.dateTo || '' });
  const today = getBayAreaToday(new Date(now)), weekend = getMonthlyDateRange('weekend',today)!, next7 = getMonthlyDateRange('next7',today)!;
  const weekendStart = weekend.start < today ? today : weekend.start;
  const fields = (): OutingFilters => {
    const values = form.current ? new FormData(form.current) : new FormData();
    const q = String(values.get('q') || '').trim(), city = String(values.get('city') || '').trim(), language = values.get('language');
    return { ...(q ? { q } : {}), ...(city ? { city } : {}), ...(language === 'zh' || language === 'en' ? { language } : {}), ...(values.get('seats') === 'open' ? { seats:'open' as const } : {}), sort:'soonest' };
  };
  const dates = (): OutingFilters => exactDate ? { date:exactDate } : { ...(range.from ? { dateFrom:range.from } : {}), ...(range.to ? { dateTo:range.to } : {}) };
  const choose = (choice: 'today' | 'weekend' | 'next7') => apply({ ...fields(), ...(choice === 'today' ? { date:today } : choice === 'weekend' ? { dateFrom:weekendStart,dateTo:weekend.end } : { dateFrom:next7.start,dateTo:next7.end }) });
  const hasFilters = !!(filters.eventId || filters.q || filters.city || filters.date || filters.dateFrom || filters.dateTo || filters.language || filters.seats);
  return <form ref={form} className="outing-filter outing-discovery-filter" onSubmit={event => { event.preventDefault(); apply({ ...fields(),...dates() }); }}>
    <div className="outing-filter-main"><label className="outing-search-field">{t('搜索小队','Search outings')}<span className="outing-search-input"><Search size={17} aria-hidden="true"/><input name="q" maxLength={120} defaultValue={filters.q || ''} placeholder={t('散步、看展、咖啡，或集合地点','Walk, museum, coffee or a meeting place')}/></span></label><label>{t('城市（可选）','City (optional)')}<input name="city" maxLength={80} defaultValue={filters.city || ''} placeholder={t('旧金山 / SF / San Francisco','San Francisco / SF / 旧金山')}/></label><label>{t('参加日期','Outing date')}<input name="date" type="date" value={exactDate} onChange={event => { setExactDate(event.target.value); setRange({ from:'',to:'' }); }}/></label><button className="outing-primary" type="submit">{t('筛选小队','Filter outings')}</button></div>
    <div className="outing-date-shortcuts" aria-label={t('日期快捷选择','Date shortcuts')}><button type="button" aria-pressed={filters.date === today} onClick={() => choose('today')}>{t('今天','Today')}</button><button type="button" aria-pressed={!filters.date && filters.dateFrom === weekendStart && filters.dateTo === weekend.end} onClick={() => choose('weekend')}>{t('本周末','This weekend')}</button><button type="button" aria-pressed={!filters.date && filters.dateFrom === next7.start && filters.dateTo === next7.end} onClick={() => choose('next7')}>{t('未来7天','Next 7 days')}</button><span className="outing-footnote">{t('按湾区当地日期，7天包含今天','Bay Area dates; 7 days includes today')}</span></div>
    {(range.from || range.to) && !exactDate && <div className="outing-date-range"><CalendarDays size={15}/><span>{range.from || t('不限开始日期','Any start date')} — {range.to || t('不限结束日期','Any end date')}</span><button className="outing-link-button" type="button" onClick={() => apply(fields())}>{t('清除日期','Clear dates')}</button></div>}
    <details className="outing-advanced-filter" open={filters.language || filters.seats ? true : undefined}><summary><SlidersHorizontal size={15}/>{t('更多筛选','More filters')}{(filters.language || filters.seats) && <span className="outing-footnote">{t('已启用','Active')}</span>}</summary><div className="outing-advanced-fields"><label>{t('沟通语言','Language')}<select name="language" defaultValue={filters.language || ''}><option value="">{t('不限','Any')}</option><option value="zh">{t('可用中文（含语言不限）','Chinese welcome (includes any language)')}</option><option value="en">{t('可用英文（含语言不限）','English welcome (includes any language)')}</option></select></label><label className="outing-check"><input type="checkbox" name="seats" value="open" defaultChecked={filters.seats === 'open'}/>{t('只看有空位','Only outings with open places')}</label></div></details>
    <div className="outing-filter-footer"><span className="outing-footnote">{t('支持城市中文、英文和常用简称；按即将开始排序','Chinese, English and common city names supported; soonest first')}</span>{hasFilters && <button className="outing-link-button" type="button" onClick={clear}>{t('清除筛选','Clear filters')}</button>}</div>
  </form>;
}

export function OutingsHub({ app }: { app: AppContextValue }) {
  return <OutingsSession key={outingSessionKey(app.user)} app={app} />;
}

function OutingsSession({ app }: { app: AppContextValue }) {
  const [params, setParams] = useSearchParams();
  const { t } = useOutingCopy();
  const [creating, setCreating] = useState(false);
  const session = useOutingSession(app.user);
  const filters = discoveryFilters(params), eventId = filters.eventId || '', date = filters.date || '';
  const event = MONTHLY_EVENTS.find(row => row.id === eventId);
  const mine = params.get('view') === 'mine', detailId = params.get('outing');
  const changeView = (view: 'browse' | 'mine') => { const next = new URLSearchParams(params); next.delete('outing'); if (view === 'mine') next.set('view', 'mine'); else next.delete('view'); setParams(next); };
  const create = () => { if (!app.user) { app.setShowLogin(true); return; } setCreating(true); };
  const apply = (values: OutingFilters) => { const next = new URLSearchParams(params); discoveryKeys.forEach(key => next.delete(key)); for (const [key,value] of Object.entries(values)) if (value && key !== 'eventId') next.set(key,value); setParams(next); };
  const clear = () => { const next = new URLSearchParams(params); discoveryKeys.forEach(key => next.delete(key)); next.delete('event'); setParams(next); };
  if (detailId) return <OutingDetail key={detailId} id={detailId} app={app} onBack={() => { const next = new URLSearchParams(params); next.delete('outing'); setParams(next); }} />;
  if (creating) return outingEligible(app) ? <OutingForm initial={emptyOutingDraft(event?.id, date)} session={session} onCancel={() => setCreating(false)} onSaved={result => {
    const next = new URLSearchParams(params); next.set('outing', result.outing.id); setCreating(false); setParams(next);
    app.showToast(result.notificationWarning ? t('小队已发布，但通知暂未确认发送。请查看小队状态。', 'The outing was published, but notifications could not be confirmed. Check its status.') : t('小队已发布，等待同行申请。', 'Your outing is published and ready for requests.'), result.notificationWarning ? 'info' : 'success');
  }} /> : <section className="outing-empty"><ShieldCheck size={28}/><h1>{t('先完成验证，再发起小队', 'Verify before hosting')}</h1><p>{t('发起和申请同行需要手机号验证或平台资料核验。这有助于减少滥用，但不保证身份或线下安全。', 'Hosting and joining require phone verification or platform profile review. This helps reduce misuse but does not guarantee identity or in-person safety.')}</p><div className="outing-inline-actions"><Link className="outing-primary" to="/me">{t('前往个人页验证', 'Go to profile to verify')}</Link><button className="outing-secondary" onClick={() => setCreating(false)}>{t('继续浏览小队', 'Keep browsing')}</button></div></section>;
  return <><header className="outing-hero"><div><span className="outing-eyebrow">BAYLINK · {t('把想去变成同行', 'Make a plan, find company')}</span><h1>{t('一起去，有个具体的约定。', 'A clear plan. Good company.')}</h1><p>{t('找几个人，在公共场所一起看展、散步或参加活动。先看清安排，再申请；发起人确认后才算加入。', 'Find a few people for a museum, a walk or an event in a public place. Review the plan and request a place; you join only when the host confirms.')}</p></div><button className="outing-primary" onClick={create}><Plus size={18}/>{t('发起小队', 'Create an outing')}</button></header>
    <div className="outing-rule-strip"><span><Users size={14}/>{t('18 岁以上 · 2–8 人含发起人', 'Adults 18+ · 2–8 people including the host')}</span><span><ShieldCheck size={14}/>{t('站内申请，不收款', 'Requests on BAYLINK; no platform payments')}</span><span>{t('收藏想去仍是私人记录', 'Saved activities stay private')}</span></div>
    <nav className="outing-tabs" aria-label={t('小队列表', 'Outing lists')}><button aria-pressed={!mine} onClick={() => changeView('browse')}>{t('浏览小队', 'Browse outings')}</button><button aria-pressed={mine} onClick={() => changeView('mine')}>{t('我的小队', 'My outings')}</button><Link className="outing-link-button" to="/this-month">{t('先看看活动', 'Explore events')}<ArrowUpRight size={15}/></Link></nav>
    {!mine && <><DiscoveryFilters key={JSON.stringify(filters)} filters={filters} apply={apply} clear={clear}/>
      {eventId && <div className="outing-associated">{event ? <><span>{t('只看这场活动的同行', 'Outings for this event')} · </span><Link to={`/events/${encodeURIComponent(event.id)}`}>{event.title}</Link><p>{t('多日活动请用上方日期选定实际参加的一天。小队不代替主办方报名或购票。', 'For a multi-day event, choose the day you will attend above. Joining a team does not replace official registration or tickets.')}</p></> : <p>{t('关联活动暂不可用。可以清除筛选浏览其他小队；发布时请重新核对活动。', 'The linked event is unavailable. Clear filters to browse other outings and check the event before publishing.')}</p>}</div>}</>}
    <OutingList key={`${mine ? 'mine' : 'browse'}:${JSON.stringify(filters)}`} app={app} mine={mine} filters={filters} create={create} />
    <p className="outing-footnote outing-toolbar">{t('小队是个人发起的同行安排；活动报名、门票、服务预约各自处理。出发前请再次核对主办方公告，联系方式不要公开发布。', 'Outings are independently organized. Official registration, tickets and service bookings are handled separately. Recheck organizer updates before leaving and keep contact details private.')}</p>
  </>;
}

function OutingList({ app, mine, filters, create }: { app: AppContextValue; mine: boolean; filters: OutingFilters; create: () => void }) {
  const { t } = useOutingCopy(), session = useOutingSession(app.user);
  const now = useOutingNow();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<Outing[]>([]), [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const serial = useRef(0), lock = useRef(false);
  const { eventId, date, city, q, dateFrom, dateTo, language, seats, sort } = filters;
  const load = useCallback(async (after?: string) => {
    if (mine && !app.user) { setLoading(false); return; }
    if (!session.current() || lock.current) return;
    lock.current = true; const version = ++serial.current, controller = session.controller(); setLoading(true); setError('');
    try {
      const response = mine ? await outings.mine(controller.signal) : await outings.list({ eventId, date, city, q, dateFrom, dateTo, language, seats, sort, ...(after ? { cursor: after } : {}) }, controller.signal);
      if (response.outings.some(row => row.me && row.me.userId !== app.user?.id)) throw new Error('Unexpected outing account');
      if (mine && response.outings.some(row => row.host.id !== app.user?.id && !row.me)) throw new Error('Unexpected private outing');
      if (!session.current() || controller.signal.aborted || version !== serial.current) return;
      setRows(previous => after ? [...new Map([...previous,...response.outings].map(row => [row.id,row])).values()] : response.outings);
      setCursor('nextCursor' in response ? response.nextCursor as string | null : null);
    } catch (reason) { if (session.current() && !controller.signal.aborted && version === serial.current) setError(outingError(reason,t,true)); }
    finally { session.release(controller); if (session.current() && version === serial.current) { lock.current = false; setLoading(false); } }
  }, [app.user, mine, eventId, date, city, q, dateFrom, dateTo, language, seats, sort, session, t]);
  useEffect(() => { void load(); return () => { ++serial.current; lock.current = false; }; }, [load]);
  if (mine && !app.user) return <section className="outing-empty"><Users size={28}/><h2>{t('登录查看你的申请和小队', 'Sign in to see your outings')}</h2><p>{t('这里汇总你发起、申请和加入的小队。收藏活动不会自动创建小队或公开你的资料。', 'See outings you host, requested or joined. Saving an event does not create an outing or publish your profile.')}</p><button className="outing-primary" onClick={() => app.setShowLogin(true)}>{t('登录后继续', 'Sign in to continue')}</button></section>;
  // Keep a user's own records reachable after blocking a host so they can withdraw.
  const visible = rows.filter(row => mine || !app.blockedUserIds.includes(row.host.id));
  const link = (row: Outing) => { const next = new URLSearchParams(params); next.set('outing',row.id); return `/together?${next}`; };
  return <section aria-label={mine ? t('我的小队结果', 'My outing results') : t('小队搜索结果', 'Outing results')}><div className="outing-toolbar"><span className="outing-footnote">{mine ? t('查看申请状态、确认变更与成员讨论', 'Check requests, changes and team discussions') : t('按具体日期和公共集合地点选择', 'Choose by date and public meeting place')}</span><button className="outing-link-button" disabled={loading} onClick={() => void load()}><RefreshCw size={14}/>{t('刷新列表', 'Refresh list')}</button></div>
    {error && <div className="outing-error" role="alert"><p>{error}</p>{rows.length > 0 && <p>{t('下方为上次读取的结果，可能已有变化。', 'Results below are from the previous load and may have changed.')}</p>}<button className="outing-secondary" disabled={loading} onClick={() => void load()}>{t('重新读取', 'Try again')}</button></div>}
    {loading && <p className="outing-read-status" role="status">{t('正在读取小队…', 'Loading outings…')}</p>}
    {!loading && !error && !visible.length && <div className="outing-empty"><Users size={30}/><h2>{mine ? t('你的同行从这里开始', 'Your outings start here') : cursor ? t('还有小队待查看','More outings to check') : rows.length ? t('暂无可显示的小队', 'No outings to show') : t('还没有符合条件的小队', 'No outings match yet')}</h2><p>{mine ? t('还没有小队记录。先浏览一个具体日期，或发起你已经核对好安排的小队。', 'You have no outing records yet. Browse a date or create a team once you have checked the plan.') : cursor ? t('这一页暂无符合条件或可显示的小队。点“查看更多小队”继续读取后续结果。','This page has no matching or visible outings. Select “Load more outings” to check the remaining results.') : t('可以换一个日期或城市，也可以发起 2–8 人的小队。活动收藏仍是你的私人记录，不会自动公开招募。', 'Try another date or city, or create a team of 2–8. Saved events remain private and do not automatically recruit companions.')}</p>{!cursor && <div className="outing-inline-actions"><button className="outing-primary" onClick={create}>{t('发起小队', 'Create an outing')}</button><Link className="outing-secondary" to="/this-month">{t('先看看活动', 'Explore events')}</Link></div>}</div>}
    <div className="outing-grid">{visible.map(row => <article className="outing-card" key={row.id}><div className="outing-card-top"><span className={`outing-badge${row.status !== 'open' || row.endAt <= now ? ' is-muted' : ''}`}>{outingLabel(row,t,now)}</span><span>{row.confirmedCount}/{row.capacity} {t('人 · 含发起人', 'people · includes host')}</span></div><h2><Link to={link(row)}>{row.title}</Link></h2><p className="outing-meta"><CalendarDays size={16}/>{row.date} · {row.startTime}–{row.endTime}</p><p className="outing-meta"><MapPin size={16}/>{row.city} · {row.venue}</p><p className="outing-availability">{row.status === 'open' && row.startAt > now ? row.confirmedCount < row.capacity ? t(`还可接受 ${row.capacity - row.confirmedCount} 人 · 需发起人确认`, `${row.capacity - row.confirmedCount} ${row.capacity - row.confirmedCount === 1 ? 'place' : 'places'} open · host approval required`) : t('满员可候补，不会自动加入','Waitlist available; joining is not automatic') : t('报名已结束','Joining has closed')}</p><p className="outing-card-summary">{row.description.length > 150 ? `${row.description.slice(0,150)}…` : row.description}</p>{row.me && <span className="outing-badge">{row.me.role === 'host' ? t('我发起的', 'Hosted by me') : row.me.status === 'confirmed' && row.me.confirmedVersion < row.planVersion ? t('安排已变，待重新确认', 'Plan changed — reconfirm') : memberLabel(row.me.status,t,row.me.waitlisted)}</span>}<footer className="outing-card-footer"><span className="outing-footnote">{t('发起人', 'Host')} · {row.host.nickname}</span><Link className="outing-secondary" to={link(row)}>{t('查看安排', 'View plan')}<ArrowUpRight size={15}/></Link></footer></article>)}</div>
    {cursor && <div className="outing-load-more"><button className="outing-secondary" disabled={loading} onClick={() => void load(cursor)}>{loading ? t('正在读取…', 'Loading…') : t('查看更多小队', 'Load more outings')}</button></div>}
  </section>;
}
