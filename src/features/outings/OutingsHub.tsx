import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRight, CalendarDays, MapPin, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import type { AppContextValue } from '../../app/context';
import { MONTHLY_EVENTS } from '../../data/monthly-edition';
import { outings, type Outing, type OutingDraft, type OutingFilters } from '../../lib/outings';
import { getBayAreaToday, getMonthlyDateRange } from '../../lib/monthly';
import { DateChips, type DateChoice } from '../../components/ui/DateChips';
import { dateWords } from '../../components/ui/date-words';
import { Select } from '../../components/ui/Select';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { Button } from '../../components/ui/Button';
import { OutingDetail, OutingHostForm, memberLabel, outingEligible, outingLabel } from './OutingDetail';
import { outingLastDay, useOutingCopy, useOutingNow } from './outing-copy';
import { outingError, outingSessionKey, useOutingSession } from './outing-session';
import { OutingCover } from './OutingCover';
import { coverFromSearchParams } from './outing-cover';
import { readOutingPlanHandoff } from '../../lib/outing-plan-handoff';
import { AccountBand } from '../../components/AccountBand';
import { BAND_PHOTOS } from '../../lib/account-band-photos';
// The plan hand-off checks its stops against the planner catalog: lib/planner installs the full one (WEB-PLAN-DATA).
import '../../lib/planner';
import './outings.css';
import './outing-cover.css';

const emptyOutingDraft = (eventId = '', date = ''): OutingDraft => {
  const event = MONTHLY_EVENTS.find(row => row.id === eventId);
  return { title: event ? `${event.title} · 一起去` : '', description: '', eventId: event?.id || null, date,
    startTime: '', endTime: '', city: event?.city || '', venue: event?.venue || '', capacity: 4,
    costNote: '', transport: 'own', language: 'any' };
};

/** True when the site footer is below the fold (or absent). See `reserve` in OutingsSession. */
function footerBelowFold() {
  if (typeof window === 'undefined') return true;
  const footer = document.querySelector('.site-footer');
  return !footer || footer.getBoundingClientRect().top >= window.innerHeight;
}

const discoveryKeys = ['q','city','date','dateFrom','dateTo','language','seats','sort','cursor'] as const;
function discoveryFilters(params: URLSearchParams): OutingFilters {
  const date = params.get('date') || '', language = params.get('language');
  return { ...(params.get('event') ? { eventId:params.get('event')! } : {}),
    ...(params.get('q') ? { q:params.get('q')!.trim() } : {}), ...(params.get('city') ? { city:params.get('city')!.trim() } : {}),
    ...(date ? { date } : { ...(params.get('dateFrom') ? { dateFrom:params.get('dateFrom')! } : {}), ...(params.get('dateTo') ? { dateTo:params.get('dateTo')! } : {}) }),
    ...(language === 'zh' || language === 'en' ? { language } : {}), ...(params.get('seats') === 'open' ? { seats:'open' as const } : {}), sort:'soonest' };
}

/** The date filter as a DateChips choice: today, the weekend, the next 7 days or one day; null for no date or another range. */
function dateChoiceOf(filters: Pick<OutingFilters, 'date' | 'dateFrom' | 'dateTo'>, today: string, weekend: { start: string; end: string }, next7: { start: string; end: string }): DateChoice | null {
  if (filters.date) return filters.date === today ? { kind:'today' } : { kind:'date', date:filters.date };
  if (filters.dateFrom === weekend.start && filters.dateTo === weekend.end) return { kind:'weekend' };
  if (filters.dateFrom === next7.start && filters.dateTo === next7.end) return { kind:'next7' };
  return null;
}

type DateFilters = Pick<OutingFilters, 'date' | 'dateFrom' | 'dateTo'>;
const datesOf = (filters: OutingFilters): DateFilters => filters.date ? { date:filters.date } : { ...(filters.dateFrom ? { dateFrom:filters.dateFrom } : {}), ...(filters.dateTo ? { dateTo:filters.dateTo } : {}) };

/**
 * Discovery (DECISIONS 41, NAV PR B: one search field and a 筛选 chip that opens a sheet). The search field filters at once on
 * Enter and keeps the other filters; 筛选 opens the site's Sheet with 城市, 参加日期 (the date chips), 沟通语言 and 只看有空位,
 * which apply together on 显示小队 (its one solid button) and reset on 清除. Under the bar, the filters in force in words, with
 * 清除筛选. The chip names how many are on, so a closed sheet never hides an active filter.
 */
function DiscoveryFilters({ filters, apply, clear }: { filters: OutingFilters; apply: (value: OutingFilters) => void; clear: () => void }) {
  const { t, locale } = useOutingCopy(), now = useOutingNow();
  const bar = useRef<HTMLFormElement>(null), sheet = useRef<HTMLFormElement>(null), chip = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const today = getBayAreaToday(new Date(now)), weekendRange = getMonthlyDateRange('weekend',today)!, next7 = getMonthlyDateRange('next7',today)!;
  const weekend = { start:weekendRange.start < today ? today : weekendRange.start, end:weekendRange.end };
  const words = dateWords(locale);
  // The sheet's date choice is a draft until 显示小队; choosing the selected quick range again clears it.
  const [dates, setDates] = useState<DateFilters>(() => datesOf(filters));
  const chosen = dateChoiceOf(dates, today, weekend, next7);
  const choose = (choice: DateChoice) => setDates(choice.kind !== 'date' && chosen?.kind === choice.kind ? {} : choice.kind === 'today' ? { date:today } : choice.kind === 'date' ? { date:choice.date } : choice.kind === 'weekend' ? { dateFrom:weekend.start,dateTo:weekend.end } : { dateFrom:next7.start,dateTo:next7.end });
  const dateLine = (value: DateFilters) => value.date ? words.day(value.date) : `${value.dateFrom ? words.day(value.dateFrom) : t('不限开始日期','Any start date')} — ${value.dateTo ? words.day(value.dateTo) : t('不限结束日期','Any end date')}`;
  const query = () => { const q = String((bar.current ? new FormData(bar.current) : new FormData()).get('q') || '').trim(); return q ? { q } : {}; };
  const kept = (): OutingFilters => ({ ...(filters.city ? { city:filters.city } : {}), ...(filters.language ? { language:filters.language } : {}), ...(filters.seats ? { seats:filters.seats } : {}), ...datesOf(filters), sort:'soonest' });
  const fromSheet = (): OutingFilters => {
    const values = sheet.current ? new FormData(sheet.current) : new FormData();
    const city = String(values.get('city') || '').trim(), language = values.get('language');
    return { ...(city ? { city } : {}), ...(language === 'zh' || language === 'en' ? { language } : {}), ...(values.get('seats') === 'open' ? { seats:'open' as const } : {}), ...dates, sort:'soonest' };
  };
  const reset = () => { for (const field of sheet.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name=city],select[name=language]') ?? []) field.value = ''; const seats = sheet.current?.querySelector<HTMLInputElement>('input[name=seats]'); if (seats) seats.checked = false; setDates({}); };
  const openSheet = () => { setDates(datesOf(filters)); setOpen(true); };
  const hasDates = !!(filters.date || filters.dateFrom || filters.dateTo);
  const languageWords = filters.language === 'zh' ? t('可用中文','Chinese welcome') : filters.language === 'en' ? t('可用英文','English welcome') : '';
  const active = [hasDates && dateLine(datesOf(filters)), filters.city, languageWords, filters.seats === 'open' && t('只看有空位','Open places only')].filter((item): item is string => !!item);
  const hasFilters = !!(filters.eventId || filters.q || active.length);
  return <div className="outing-discovery">
    <form ref={bar} className="outing-discovery-bar" role="search" onSubmit={event => { event.preventDefault(); apply({ ...kept(), ...query() }); }}>
      <label className="outing-search-field"><span className="ui-visually-hidden">{t('搜索小队','Search outings')}</span><span className="outing-search-input"><Search aria-hidden="true"/><input name="q" maxLength={120} defaultValue={filters.q || ''} enterKeyHint="search" placeholder={t('散步、看展、咖啡或集合点','Walk, museum, coffee…')}/></span></label>
      <button ref={chip} type="button" className="outing-filter-chip" aria-haspopup="dialog" aria-expanded={open} aria-label={active.length ? t(`筛选，已选 ${active.length} 项`, `Filters, ${active.length} on`) : undefined} data-active={active.length ? '' : undefined} onClick={openSheet}><SlidersHorizontal aria-hidden="true"/>{t('筛选','Filters')}{active.length > 0 && <span className="outing-filter-count" aria-hidden="true">{active.length}</span>}</button>
    </form>
    {(active.length > 0 || hasFilters) && <div className="outing-filter-summary"><span className="ui-visually-hidden">{t('已选筛选：','Filters on: ')}</span>{active.map(item => <span key={item} className="outing-filter-token">{item}</span>)}<button className="outing-link-button" type="button" onClick={clear}>{t('清除筛选','Clear filters')}</button></div>}
    <Sheet open={open} onClose={() => setOpen(false)} title={t('筛选小队','Filter outings')} restoreFocusRef={chip} className="outing-filter-sheet"
      footer={<><button className="outing-link-button" type="button" onClick={reset}>{t('清除','Clear')}</button><button className="outing-primary" type="submit" form="outing-filter-form">{t('显示小队','Show outings')}</button></>}>
      <form id="outing-filter-form" ref={sheet} className="outing-filter-form" onSubmit={event => { event.preventDefault(); setOpen(false); apply({ ...query(), ...fromSheet() }); }}>
        <div className="outing-city-field"><label>{t('城市（可选）','City (optional)')}<input name="city" maxLength={80} defaultValue={filters.city || ''} placeholder={t('旧金山 / SF','SF, Oakland…')}/></label><p className="outing-footnote">{t('支持城市中文、英文和常用简称；按即将开始排序','Chinese, English and common city names supported; soonest first')}</p></div>
        <div className="outing-date-field"><span className="outing-field-label" aria-hidden="true">{t('参加日期','Outing date')}</span><DateChips value={chosen} onChange={choose} today={today} max={outingLastDay(today)} label={t('参加日期','Outing date')} /><p className="outing-footnote">{t('按湾区当地日期；未来 7 天包含今天','Bay Area dates; the next 7 days include today')}</p>
          {(dates.date || dates.dateFrom || dates.dateTo) && <p className="outing-date-range"><CalendarDays size={16} aria-hidden="true"/><span>{dateLine(dates)}</span><button className="outing-link-button" type="button" onClick={() => setDates({})}>{t('清除日期','Clear dates')}</button></p>}</div>
        <label>{t('沟通语言','Language')}<Select name="language" className="ui-select__field--chip" defaultValue={filters.language || ''}><option value="">{t('不限','Any')}</option><option value="zh">{t('可用中文（含语言不限）','Chinese welcome (includes any language)')}</option><option value="en">{t('可用英文（含语言不限）','English welcome (includes any language)')}</option></Select></label>
        <label className="outing-check"><input type="checkbox" name="seats" value="open" defaultChecked={filters.seats === 'open'}/>{t('只看有空位','Only outings with open places')}</label>
      </form>
    </Sheet>
  </div>;
}

export function OutingsHub({ app }: { app: AppContextValue }) {
  return <OutingsSession key={outingSessionKey(app.user)} app={app} />;
}

function OutingsSession({ app }: { app: AppContextValue }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const { t } = useOutingCopy();
  const [creating, setCreating] = useState(false);
  const session = useOutingSession(app.user);
  // The results area keeps the empty state's height while a list loads, so nothing below it moves when the list arrives
  // (desktop CLS). Not on the page's first frame when the site footer is already on screen: on a cold load the route-wait
  // fallback (site-chrome.css .site-route-wait, 60vh) leaves it there, the first frame moves it anyway and a reserved
  // area would move it further. From the first loaded list on, every load keeps the height.
  const [reserve, setReserve] = useState(footerBelowFold);
  const settled = useCallback(() => setReserve(true), []);
  // One solid primary per view (UI9-R1): the head's 发起小队 steps down to secondary while the list shows its own primary
  // (登录后继续 on 我的小队 for a guest, known from the first paint; 重试 after a failed load, which the list reports) or a
  // draft / cover hand-off offers the same step with context.
  const [listLeads, setListLeads] = useState(false);
  const filters = discoveryFilters(params), eventId = filters.eventId || '', date = filters.date || '';
  const event = MONTHLY_EVENTS.find(row => row.id === eventId);
  const cover = coverFromSearchParams(params);
  const planDraft = params.get('draft') === 'plan' ? readOutingPlanHandoff(location.state, app.user?.id) : null;
  const initialDraft = planDraft || { ...emptyOutingDraft(event?.id, date), ...(cover ? { cover } : {}) };
  const mine = params.get('view') === 'mine', detailId = params.get('outing');
  const headAction = listLeads || (mine && !app.user) || !!planDraft || (!!cover && !mine) ? 'outing-secondary' : 'outing-primary';
  const changeView = (view: 'browse' | 'mine') => { const next = new URLSearchParams(params); next.delete('outing'); if (view === 'mine') next.set('view', 'mine'); else next.delete('view'); setParams(next); };
  const create = () => { if (!app.user) { app.setShowLogin(true); return; } setCreating(true); };
  const apply = (values: OutingFilters) => { const next = new URLSearchParams(params); discoveryKeys.forEach(key => next.delete(key)); for (const [key,value] of Object.entries(values)) if (value && key !== 'eventId') next.set(key,value); setParams(next); };
  const clear = () => { const next = new URLSearchParams(params); discoveryKeys.forEach(key => next.delete(key)); next.delete('event'); setParams(next); };
  if (detailId) return <OutingDetail key={detailId} id={detailId} app={app} onBack={() => { const next = new URLSearchParams(params); next.delete('outing'); setParams(next); }} />;
  if (creating) return outingEligible(app) ? <OutingHostForm lead={planDraft && <p className="outing-footnote">{t('已带入你的计划草稿。请核对集合地点、结束时间和费用说明；发布后这些内容会公开展示。', 'Your plan draft is ready. Review the meeting place, end time and costs; these details become public only when you publish.')}</p>} initial={initialDraft} session={session} onCancel={() => setCreating(false)} onSaved={result => {
    const next = new URLSearchParams(params); next.set('outing', result.outing.id); setCreating(false); setParams(next);
    app.showToast(result.notificationWarning ? t('小队已发布，但通知暂未确认发送。请查看小队状态。', 'The outing was published, but notifications could not be confirmed. Check its status.') : t('小队已发布，等待同行申请。', 'Your outing is published and ready for requests.'), result.notificationWarning ? 'info' : 'success');
  }} /> : <section className="outing-empty"><ShieldCheck size={28}/><h1>{t('先完成验证，再发起小队', 'Verify before hosting')}</h1><p>{t('发起和申请同行需要手机号验证或平台资料核验。这有助于减少滥用，但不保证身份或线下安全。', 'Hosting and joining require phone verification or platform profile review. This helps reduce misuse but does not guarantee identity or in-person safety.')}</p><div className="outing-inline-actions"><Link className="outing-primary" to="/me">{t('前往个人页验证', 'Go to profile to verify')}</Link><button className="outing-secondary" onClick={() => setCreating(false)}>{t('继续浏览小队', 'Keep browsing')}</button></div></section>;
  return <><AccountBand photo={BAND_PHOTOS.together} className="outing-band" /><header className="outing-hero"><div><span className="outing-eyebrow">BAYLINK · {t('把想去变成同行', 'Make a plan, find company')}</span><h1>{t('一起去，有个具体的约定。', 'A clear plan. Good company.')}</h1><p>{t('找几个人，在公共场所一起看展、散步或参加活动。先看清安排，再申请；发起人确认后才算加入。', 'Find a few people for a museum, a walk or an event in a public place. Review the plan and request a place; you join only when the host confirms.')}</p></div><button className={headAction} onClick={create}><Plus size={18}/>{t('发起小队', 'Create an outing')}</button></header>
    <div className="outing-rule-strip"><span><Users size={14}/>{t('18 岁以上 · 2–8 人含发起人', 'Adults 18+ · 2–8 people including the host')}</span><span><ShieldCheck size={14}/>{t('站内申请，不收款', 'Requests on BAYLINK; no platform payments')}</span><span>{t('收藏想去仍是私人记录', 'Saved activities stay private')}</span></div>
    {planDraft && <section className="outing-inspiration-context" aria-label={t('来自我的计划草稿', 'Draft from my plan')}><div><span className="outing-eyebrow">{t('下一步，找人一起去', 'Next, find company')}</span><h2>{planDraft.title}</h2><p>{t('路线灵感已带入。先核对时间、公共集合地点和费用说明，再决定是否公开发起小队。', 'Your route is ready as a draft. Review the time, public meeting place and costs before publishing an outing.')}</p><button type="button" className="outing-primary" onClick={create}>{t('检查草稿并发起小队', 'Review draft and create outing')}</button></div><OutingCover outing={planDraft} variant="preview" /></section>}
    <nav className="outing-tabs" aria-label={t('小队列表', 'Outing lists')}><button aria-pressed={!mine} onClick={() => changeView('browse')}>{t('浏览小队', 'Browse outings')}</button><button aria-pressed={mine} onClick={() => changeView('mine')}>{t('我的小队', 'My outings')}</button><Link className="outing-link-button" to="/events?when=all">{t('先看看活动', 'Explore events')}<ChevronRight size={15}/></Link></nav>
    {!mine && <><DiscoveryFilters key={JSON.stringify(filters)} filters={filters} apply={apply} clear={clear}/>
      {eventId && <div className="outing-associated">{event ? <><span>{t('只看这场活动的同行', 'Outings for this event')} · </span><Link to={`/events/${encodeURIComponent(event.id)}`}>{event.title}</Link><p>{t('多日活动请用上方日期选定实际参加的一天。小队不代替主办方报名或购票。', 'For a multi-day event, choose the day you will attend above. Joining a team does not replace official registration or tickets.')}</p></> : <p>{t('关联活动暂不可用。可以清除筛选浏览其他小队；发布时请重新核对活动。', 'The linked event is unavailable. Clear filters to browse other outings and check the event before publishing.')}</p>}</div>}</>}
    {cover && !mine && <section className="outing-inspiration-context" aria-label={t('已带入的参考内容', 'Selected inspiration')}><div><span className="outing-eyebrow">{t('从灵感到同行', 'From inspiration to company')}</span><h2>{t('配图已准备好，约个时间一起去。', 'Your cover is ready. Make a plan together.')}</h2><p>{t('发起时会带入这篇内容的配图和参考链接。请自己填写具体时间与公共集合地点；参考内容不代表已报名或已预订。', 'Your outing will carry this article’s cover and reference link. Set your own time and public meeting place; the reference does not reserve tickets or places.')}</p><div className="outing-inline-actions"><button type="button" className="outing-primary" onClick={create}>{t('用这张配图发起小队', 'Create with this cover')}</button><button type="button" className="outing-link-button" onClick={() => { const next = new URLSearchParams(params); next.delete('coverKind'); next.delete('coverId'); setParams(next); }}>{t('取消带入', 'Clear inspiration')}</button></div></div><OutingCover outing={initialDraft} variant="preview" /></section>}
    <OutingList key={`${mine ? 'mine' : 'browse'}:${JSON.stringify(filters)}`} app={app} mine={mine} filters={filters} create={create} reserve={reserve} settled={settled} leads={setListLeads} />
    <p className="outing-footnote outing-toolbar">{t('小队是个人发起的同行安排；活动报名、门票、服务预约各自处理。出发前请再次核对主办方公告，联系方式不要公开发布。', 'Outings are independently organized. Official registration, tickets and service bookings are handled separately. Recheck organizer updates before leaving and keep contact details private.')}</p>
  </>;
}

function OutingList({ app, mine, filters, create, reserve, settled, leads }: { app: AppContextValue; mine: boolean; filters: OutingFilters; create: () => void; reserve: boolean; settled: () => void; leads: (value: boolean) => void }) {
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
  useEffect(() => { if (!loading) settled(); }, [loading, settled]);
  // The list's 重试 takes the view's one solid button from the head while it shows (the guest case is the session's own).
  const failed = !!error;
  useEffect(() => { leads(failed); }, [failed, leads]);
  useEffect(() => () => leads(false), [leads]);
  if (mine && !app.user) return <EmptyState icon={Users} title={t('登录查看你的申请和小队', 'Sign in to see your outings')} body={t('这里汇总你发起、申请和加入的小队。收藏活动不会自动创建小队或公开你的资料。', 'See outings you host, requested or joined. Saving an event does not create an outing or publish your profile.')} actions={<Button variant="primary" onClick={() => app.setShowLogin(true)}>{t('登录后继续', 'Sign in to continue')}</Button>} />;
  // Keep a user's own records reachable after blocking a host so they can withdraw.
  const visible = rows.filter(row => mine || !app.blockedUserIds.includes(row.host.id));
  const link = (row: Outing) => { const next = new URLSearchParams(params); next.set('outing',row.id); return `/together?${next}`; };
  return <section aria-label={mine ? t('我的小队结果', 'My outing results') : t('小队搜索结果', 'Outing results')}><div className="outing-toolbar"><span className="outing-footnote">{mine ? t('查看申请状态、确认变更与成员讨论', 'Check requests, changes and team discussions') : t('按具体日期和公共集合地点选择', 'Choose by date and public meeting place')}</span><button className="outing-link-button" disabled={loading} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true"/>{t('刷新列表', 'Refresh list')}</button></div>
    <div className={`outing-results${reserve ? ' is-reserved' : ''}`} aria-busy={loading}>
    {error && <ErrorState title={t('小队列表暂时没能读取', 'The outing list didn’t load')} body={rows.length > 0 ? `${error} ${t('下方为上次读取的结果，可能已有变化。', 'Results below are from the previous load and may have changed.')}` : error} onRetry={() => void load()} homeTo={null} />}
    {loading && <p className="outing-read-status" role="status">{t('正在读取小队…', 'Loading outings…')}</p>}
    {!loading && !error && !visible.length && <EmptyState icon={Users} title={mine ? t('你的同行从这里开始', 'Your outings start here') : cursor ? t('还有小队待查看','More outings to check') : rows.length ? t('暂无可显示的小队', 'No outings to show') : t('还没有符合条件的小队', 'No outings match yet')} body={mine ? t('还没有小队记录。先浏览一个具体日期，或发起你已经核对好安排的小队。', 'You have no outing records yet. Browse a date or create a team once you have checked the plan.') : cursor ? t('这一页暂无符合条件或可显示的小队。点“查看更多小队”继续读取后续结果。','This page has no matching or visible outings. Select “Load more outings” to check the remaining results.') : t('可以换一个日期或城市，也可以发起 2–8 人的小队。活动收藏仍是你的私人记录，不会自动公开招募。', 'Try another date or city, or create a team of 2–8. Saved events remain private and do not automatically recruit companions.')} actions={!cursor && <><Button onClick={create}>{t('发起小队', 'Create an outing')}</Button><Button variant="quiet" to="/events?when=all">{t('先看看活动', 'Explore events')}</Button></>} />}
    <div className="outing-grid">{visible.map(row => <article className="outing-card" key={row.id}>
      <OutingCover outing={row} variant="card" to={link(row)} />
      <div className="outing-card-body">
        <div className="outing-card-top"><span className={`outing-badge${row.status !== 'open' || row.endAt <= now ? ' is-muted' : ''}`}>{outingLabel(row,t,now)}</span><span>{row.confirmedCount}/{row.capacity} {t('人 · 含发起人', 'people · includes host')}</span></div>
        <h2><Link to={link(row)}>{row.title}</Link></h2>
        <p className="outing-meta"><CalendarDays size={16} aria-hidden="true"/>{row.date} · {row.startTime}–{row.endTime}</p>
        <p className="outing-meta"><MapPin size={16} aria-hidden="true"/>{row.city} · {row.venue}</p>
        <p className="outing-availability">{row.status === 'open' && row.startAt > now ? row.confirmedCount < row.capacity ? t(`还可接受 ${row.capacity - row.confirmedCount} 人 · 需发起人确认`, `${row.capacity - row.confirmedCount} ${row.capacity - row.confirmedCount === 1 ? 'place' : 'places'} open · host approval required`) : t('满员可候补，不会自动加入','Waitlist available; joining is not automatic') : t('报名已结束','Joining has closed')}</p>
        <p className="outing-card-summary">{row.description.length > 150 ? `${row.description.slice(0,150)}…` : row.description}</p>
        {row.me && <span className="outing-badge">{row.me.role === 'host' ? t('我发起的', 'Hosted by me') : row.me.status === 'confirmed' && row.me.confirmedVersion < row.planVersion ? t('安排已变，待重新确认', 'Plan changed — reconfirm') : memberLabel(row.me.status,t,row.me.waitlisted)}</span>}
        <footer className="outing-card-footer"><span className="outing-footnote">{t('发起人', 'Host')} · {row.host.nickname}</span><Link className="outing-secondary" to={link(row)}>{t('查看安排', 'View plan')}<ChevronRight size={15}/></Link></footer>
      </div>
    </article>)}</div>
    {cursor && <div className="outing-load-more"><button className="outing-secondary" disabled={loading} onClick={() => void load(cursor)}>{loading ? t('正在读取…', 'Loading…') : t('查看更多小队', 'Load more outings')}</button></div>}
    </div>
  </section>;
}
