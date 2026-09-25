import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, MapPin, Ticket, X } from 'lucide-react';
import { PLANNER_EVENTS } from '../data/planner-catalog';
import { ATTRACTION_REGIONS } from '../data/attractions';
import { EVENT_SCHEDULE_NOTES } from '../data/event-calendar-dates';
import { useLocale, translateText } from '../i18n/locale';
import { getBayAreaToday } from '../lib/monthly';
import { CALENDAR_METADATA, addCalendarDays, calendarCells, calendarPeriod, eventOccursOn, eventsOnCalendarDay, groupCalendarMapEvents, shiftCalendarPeriod, validCalendarDay, type CalendarView } from '../lib/event-calendar';
import { setPageMetadata } from '../lib/seo';
import { recordProductEvent } from '../lib/product-events';
import { GUIDE_IMAGES } from '../data/guide-media';
import { GuideFigure } from '../components/GuideVisuals';

const EventMap = lazy(() => import('../components/CalendarEventMap').then(module => ({ default: module.CalendarEventMap })));
const categories = [{ id: 'culture', label: '艺术文化' }, { id: 'family', label: '亲子活动' }, { id: 'outdoors', label: '户外探索' }, { id: 'food', label: '美食市集' }];

export default function CalendarPage({ today: suppliedToday }: { today?: string } = {}) {
  const locale = useLocale(); const t = (text: string) => translateText(text, locale);
  const [localToday, setToday] = useState(getBayAreaToday);
  const today = suppliedToday || localToday;
  const [params, setParams] = useSearchParams();
  const dateParam = params.get('date') || '';
  const date = validCalendarDay(dateParam) ? dateParam : today;
  const view: CalendarView = params.get('view') === 'week' ? 'week' : 'month';
  const region = ATTRACTION_REGIONS.some(item => item.id === params.get('region')) ? params.get('region')! : 'all';
  const [focus, setFocus] = useState({ scope: '', city: '', point: '' });
  const scope = `${date}:${region}`;
  const city = focus.scope === scope ? focus.city : '';
  const selectedId = focus.scope === scope ? focus.point : '';
  useEffect(() => { setPageMetadata(CALENDAR_METADATA); }, [locale]);
  useEffect(() => {
    const refresh = () => setToday(getBayAreaToday());
    const timer = window.setInterval(refresh, 60000); window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const update = (values: Record<string, string>) => setParams(previous => {
    const next = new URLSearchParams(previous); for (const [key, value] of Object.entries(values)) { if (value && value !== 'all') next.set(key, value); else next.delete(key); } return next;
  });
  const countText = (count: number, short = false) => locale === 'en' ? `${count} ${count === 1 ? 'event' : 'events'}` : `${count} ${t(short ? '场' : '场活动')}`;
  const dateText = (day: string, options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', weekday: 'long' }) => new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  const pool = useMemo(() => PLANNER_EVENTS.filter(event => region === 'all' || event.region === region), [region]);
  const period = calendarPeriod(date, view);
  const cells = calendarCells(date, view);
  const periodEvents = pool.filter(event => period.days.some(day => eventOccursOn(event, day)));
  const dayEvents = useMemo(() => eventsOnCalendarDay(pool, date), [pool, date]);
  const cities = [...new Set(dayEvents.map(event => event.city))];
  const cityEvents = useMemo(() => dayEvents.filter(event => !city || event.city === city), [dayEvents, city]);
  const mapped = useMemo(() => groupCalendarMapEvents(cityEvents), [cityEvents]);
  const selectedPoint = mapped.points.find(point => point.id === selectedId);
  const visibleEvents = selectedPoint ? cityEvents.filter(event => selectedPoint.eventIds.includes(event.id)) : cityEvents;
  const nearest = pool.flatMap(event => {
    for (let day = event.startDate < today ? today : event.startDate; day <= event.endDate; day = addCalendarDays(day, 1)) if (eventOccursOn(event, day)) return [day];
    return [];
  }).sort()[0];
  const past = date < today;
  const periodLabel = view === 'month' ? dateText(date, { year: 'numeric', month: 'long' }) : `${dateText(period.start, { month: 'short', day: 'numeric' })} – ${dateText(period.end, { year: 'numeric', month: 'short', day: 'numeric' })}`;
  const weekDays = Array.from({ length: 7 }, (_, i) => dateText(`2026-09-${21 + i}`, { weekday: 'short' }));
  return <div className="event-calendar-page">
    <header className="ec-hero"><div><p className="ec-eyebrow"><CalendarDays size={15} /> BAY AREA / DAY BY DAY</p><h1>{t('翻开日历，看看哪天出门。')}</h1><p>{t('从一个日期开始，发现当天的湾区活动与地点。')}</p></div><Link to="/plan" className="ec-plan-link">{t('让 BayBay 帮我安排')} <ArrowUpRight size={17} /></Link></header>
    <div className="ec-toolbar"><div className="ec-view-switch" aria-label={t('日历视图')}><button type="button" aria-pressed={view === 'month'} onClick={() => update({ view: 'month' })}>{t('月历')}</button><button type="button" aria-pressed={view === 'week'} onClick={() => update({ view: 'week' })}>{t('周历')}</button></div><button type="button" className="ec-today" onClick={() => update({ date: today })}>{t('回到今天')}</button><label>{t('地区')}<select value={region} onChange={event => update({ region: event.target.value })}>{ATTRACTION_REGIONS.map(item => <option key={item.id} value={item.id}>{t(item.label)}</option>)}</select></label><label className="ec-date-jump">{t('跳到日期')}<input type="date" min="1900-01-01" max="2100-12-31" value={date} onChange={event => { if (validCalendarDay(event.target.value)) update({ date: event.target.value }); }} /></label></div>
    <div className="ec-layout">
      <section className="ec-calendar-panel" aria-label={t('活动日期日历')}>
        <div className="ec-period-nav"><button type="button" aria-label={t(view === 'month' ? '上个月' : '上一周')} disabled={!validCalendarDay(shiftCalendarPeriod(date, view, -1))} onClick={() => update({ date: shiftCalendarPeriod(date, view, -1) })}><ChevronLeft size={19} /></button><h2 aria-live="polite">{periodLabel}</h2><button type="button" aria-label={t(view === 'month' ? '下个月' : '下一周')} disabled={!validCalendarDay(shiftCalendarPeriod(date, view, 1))} onClick={() => update({ date: shiftCalendarPeriod(date, view, 1) })}><ChevronRight size={19} /></button></div>
        <p className="ec-period-summary">{t('已收录活动')} <strong>{periodEvents.length}</strong> · {t('按湾区当地日期')}</p>
        <div className="ec-weekdays" aria-hidden="true">{weekDays.map(day => <span key={day}>{day}</span>)}</div>
        <div className={`ec-days ec-days-${view}`}>{cells.map(day => {
          const events = eventsOnCalendarDay(pool, day); const inPeriod = day >= period.start && day <= period.end;
          return <button type="button" key={day} className={`ec-day${day === date ? ' is-selected' : ''}${day === today ? ' is-today' : ''}${!inPeriod ? ' is-outside' : ''}${day < today ? ' is-past' : ''}`} aria-label={`${dateText(day, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} · ${countText(events.length)}`} aria-pressed={day === date} aria-current={day === today ? 'date' : undefined} disabled={!validCalendarDay(day)} onClick={() => update({ date: day })}><span className="ec-day-number">{Number(day.slice(-2))}</span><span className="ec-day-dots" aria-hidden="true">{categories.filter(category => events.some(event => event.category === category.id)).map(category => <i key={category.id} className={`ec-dot ec-dot-${category.id}`} />)}</span><span className="ec-day-count">{events.length ? countText(events.length, true) : '—'}</span></button>;
        })}</div>
        <div className="ec-legend">{categories.map(category => <span key={category.id}><i className={`ec-dot ec-dot-${category.id}`} />{t(category.label)}</span>)}</div>
        <p className="ec-calendar-note">{t('圆点表示活动类型，数字表示当天场数。多日活动按已公布的活动日期展示，具体时段仍以主办方为准。')}</p>
        <div className="ec-help"><CalendarDays size={22} /><div><h3>{t('看见空白，也别错过下一次。')}</h3><p>{t('没有标记表示本站暂未收录，不代表当地没有活动。')}</p>{nearest && <button type="button" onClick={() => update({ date: nearest })}>{t('查看最近有活动的一天')} <ArrowRight size={15} /></button>}</div></div>
        <Link className="ec-editorial-link" to="/this-month">{t('继续逛月刊、优惠与攻略')} <ArrowUpRight size={15} /></Link>
      </section>
      <section className="ec-day-panel" aria-labelledby="ec-selected-day">
        <div className="ec-day-heading"><div><p className="ec-eyebrow">{date === today ? t('今天的湾区') : past ? t('往日活动记录') : t('这一天的湾区')}</p><h2 id="ec-selected-day">{dateText(date)}</h2></div><span className="ec-count-badge">{countText(dayEvents.length)}</span></div>
        <div className="ec-city-filter" aria-label={t('当天的城市与区域')}><button type="button" aria-pressed={!city} onClick={() => setFocus({ scope, city: '', point: '' })}>{t('全部地点')} <span>{dayEvents.length}</span></button>{cities.map(name => <button type="button" key={name} aria-pressed={city === name} onClick={() => setFocus({ scope, city: name, point: '' })}>{t(name)} <span>{dayEvents.filter(event => event.city === name).length}</span></button>)}</div>
        <Suspense fallback={<div className="ec-map-loading" role="status">{t('正在载入当天活动地图…')}</div>}><EventMap points={mapped.points} selectedId={selectedId} onSelect={id => setFocus({ scope, city, point: id })} /></Suspense>
        {mapped.unmapped.length > 0 && <p className="ec-data-note">{t('部分活动暂无已核实坐标，仍在下方列表展示。')}</p>}
        {selectedPoint && <div className="ec-selected-place"><MapPin size={15} /><span>{t(selectedPoint.title)} · {countText(selectedPoint.count)}</span><button type="button" aria-label={t('清除地图地点筛选')} onClick={() => setFocus({ scope, city, point: '' })}><X size={16} />{t('查看全部')}</button></div>}
        <div className="ec-event-list" aria-live="polite">{!visibleEvents.length ? <div className="ec-empty"><CalendarDays size={30} /><h3>{t('这一天，暂未收录活动。')}</h3><p>{t('试试日历上带标记的日期，或切换到其他地区。')}</p>{nearest && <button type="button" onClick={() => update({ date: nearest })}>{t('查看最近有活动的一天')} <ArrowRight size={15} /></button>}</div> : visibleEvents.map(event => {
          const point = mapped.points.find(item => item.eventIds.includes(event.id));
          const image = GUIDE_IMAGES[event.imageKey];
          return <article key={event.id} className={`ec-event-card ec-event-${event.category}`}>{image && <div className="ec-event-media"><GuideFigure image={image} variant="preview" /></div>}<div className="ec-event-top"><span><i className={`ec-dot ec-dot-${event.category}`} />{t(categories.find(category => category.id === event.category)?.label || '')}</span>{past && <span>{t('已结束')}</span>}</div><h3><Link to={`/events/${event.id}`}>{t(event.title)}</Link></h3><p className="ec-event-meta"><MapPin size={14} />{t(event.city)} · {t(event.venue)}</p><p className="ec-event-meta"><CalendarDays size={14} />{t(event.dateLabel)}</p><p className="ec-event-cost"><Ticket size={14} />{t(event.costLabel)}</p>{EVENT_SCHEDULE_NOTES[event.id] && <p className="ec-schedule-note">{t(EVENT_SCHEDULE_NOTES[event.id])}</p>}<div className="ec-event-actions">{point && <button type="button" onClick={() => setFocus({ scope, city, point: point.id })}><MapPin size={14} />{t(point.precision === 'venue' ? '定位场馆' : '定位城市 / 区域')}</button>}<Link to={`/events/${event.id}`}>{t('活动详情')} <ArrowUpRight size={14} /></Link>{!past && <Link className="ec-add-plan" to={`/plan?date=${date}&stops=event:${event.id}`}>{t('加入这天计划')} <ArrowRight size={14} /></Link>}<a href={event.officialUrl} target="_blank" rel="noopener noreferrer" onClick={() => recordProductEvent('official_source_click')}>{t('主办方')} <ArrowUpRight size={14} /></a></div></article>;
        })}</div>
      </section>
    </div>
  </div>;
}
