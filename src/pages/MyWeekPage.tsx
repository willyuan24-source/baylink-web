import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Trash2, WifiOff } from 'lucide-react';
import { useApp } from '../app/context';
import { ATTRACTION_REGIONS } from '../data/attractions';
import { MONTHLY_EVENTS } from '../data/monthly-edition';
import type { MonthlyEvent } from '../data/monthly-types';
import { usePlannerLibrary } from '../lib/planner-library';
import { sharePlanUrl, stopPath, stopTitle, todayInBay, WEEK_METADATA, type SavedPlan } from '../lib/planner';
import { downloadEventCalendar } from '../lib/monthly';
import { recordProductEvent } from '../lib/product-events';
import { setPageMetadata } from '../lib/seo';
import { nextConfirmedEventDate } from '../lib/event-occurrences';
import { createCoverPage, resolveCovers, type CoverPage } from '../lib/cover';
import { savedCoverImage } from '../lib/saved-items';
import { translateText, useLocale, type Locale } from '../i18n/locale';
import { PlannerAccountNotice } from '../components/PlannerAccountNotice';
import { ImportedEventsPanel } from '../components/ImportedEventsPanel';
import { MyWeekOutings } from '../features/outings/MyWeekOutings';
import { MyWeekBookings } from '../features/bookings/MyWeekBookings';
import { PlannerPreferenceMemory } from '../components/PlannerPreferenceMemory';
import { UnifiedSavedItems } from '../components/UnifiedSavedItems';
import { AddToDayPlan } from '../components/AddToDayPlan';
import { SaveHeart } from '../features/saves/SaveHeart';
import { planDisplayTitle } from '../features/saves/plan-title';
import { Button, IconButton } from '../components/ui/Button';
import { RowCard } from '../components/ui/Card';
import { ChipRow, FilterChip } from '../components/ui/Chip';
import { Cover } from '../components/ui/Cover';
import { COVER_SIZES } from '../components/ui/cover-sizes';
import { ErrorState } from '../components/ui/States';
import { PageContainer, PageHeader } from '../components/ui/HeroCard';
import { SkeletonFeed } from '../components/ui/SkeletonCard';
import { EventTypeCover } from '../components/ui/TypeCover';
import { confirmDialog } from '../components/ui/confirm';
import '../features/saves/my-week.css';

/** "10/10 周六" / "Sat 10/10" for a Pacific calendar day (zh-Hant converts the weekday at render). */
function dayLabel(date: string, english: boolean) {
  const day = new Date(`${date}T12:00:00Z`);
  const md = `${day.getUTCMonth() + 1}/${day.getUTCDate()}`;
  const weekday = new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { weekday: 'short', timeZone: 'UTC' }).format(day);
  return english ? `${weekday} ${md}` : `${md} ${weekday}`;
}

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** A plan's title: the one 加入这天计划 gave it in the page's language; a title the reader wrote as written. */
function PlanTitle({ title, locale }: { title: string; locale: Locale }) {
  const shown = planDisplayTitle(title, locale);
  return <span translate={shown.auto ? undefined : 'no'}>{shown.text}</span>;
}

/** 行程: upcoming plans as a timeline, one day per row, each plan's stops in order. */
function PlanTimeline({ plans, english, busy, onDelete }: { plans: SavedPlan[]; english: boolean; busy: boolean; onDelete: (plan: SavedPlan) => void }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const days = [...new Set(plans.map(plan => plan.date))];
  return <ol className="my-week__timeline">{days.map(date => <li key={date} id={`plan-${date}`} className="my-week__day">
    <p className="my-week__day-date"><time dateTime={date}>{dayLabel(date, english)}</time></p>
    {plans.filter(plan => plan.date === date).map(plan => <article key={plan.id} className="my-week__plan" aria-label={planDisplayTitle(plan.title, locale).text}>
      <h3><PlanTitle title={plan.title} locale={locale} /></h3>
      <ol className="my-week__stops">{plan.stops.map((stop, index) => <li key={`${stop.kind}:${stop.id}`}><span aria-hidden="true">{index + 1}</span><Link to={stopPath(stop)}>{translateText(stopTitle(stop), locale)}</Link></li>)}</ol>
      <div className="my-week__plan-actions">
        <Button variant="secondary" to={`/plan?edit=${encodeURIComponent(plan.id)}`}>{t('继续编辑', 'Edit plan')}</Button>
        <Button variant="text" href={sharePlanUrl(plan)} onClick={() => recordProductEvent('plan_shared')}>{t('分享版', 'Shareable version')}</Button>
        <IconButton label={t('删除计划', 'Delete plan')} disabled={busy} onClick={() => onDelete(plan)}><Trash2 aria-hidden="true" strokeWidth={1.75} /></IconButton>
      </div>
    </article>)}
  </li>)}</ol>;
}

/** 这周可以去: catalog events with a confirmed day in the next seven days, filtered by the reader's areas and interests. */
function WeekEvents({ events, today, coverPage, english }: { events: { event: MonthlyEvent; date: string }[]; today: string; coverPage: CoverPage; english: boolean }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const covers = useMemo(() => resolveCovers(events.map(({ event }) => ({ kind: 'event' as const, id: event.id, imageKey: event.imageKey })), { images: savedCoverImage, today, page: coverPage }), [events, today, coverPage]);
  return <ul className="my-week__list">{events.map(({ event, date }, index) => {
    const title = translateText(event.title, locale);
    return <li key={event.id} className="my-week__event">
      <RowCard title={title} to={`/events/${event.id}`} heading="h3"
        thumb={<Cover cover={covers[index]} sizes={COVER_SIZES.thumb} decorative fallback={<EventTypeCover event={event} today={today} days={[date]} size="mini" ariaHidden />} />}
        date={<><span>{t('本次', 'This visit')} </span><time dateTime={date}>{dayLabel(date, english)}</time></>}
        meta={`${translateText(event.city, locale)} · ${translateText(event.costLabel, locale)} · ${t('活动期间', 'Runs')} ${translateText(event.dateLabel, locale)}`}
        trailing={<SaveHeart kind="event" id={event.id} title={title} />} />
      <div className="my-week__row-actions">
        <AddToDayPlan stop={{ kind: 'event', id: event.id }} date={date} title={event.title} compact />
        <Button variant="text" onClick={() => downloadEventCalendar(event, date)}>{t('提醒这一天', 'Remind me that day')}</Button>
      </div>
    </li>;
  })}</ul>;
}

/**
 * 我的这周 (T10): the one save model and the plans in one place. 行程 (timeline) → 收藏 (every ♡, the count /me shows)
 * → account bookings and groups → 这周可以去. Zero, loading, error and offline states use the UI primitives (RC-25).
 */
export default function MyWeekPage() {
  const app = useApp(); const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  useEffect(() => { setPageMetadata(WEEK_METADATA); }, [locale]);
  const signedIn = !!app?.user;
  const library = usePlannerLibrary(app?.user?.id);
  const online = useOnline();
  const coverPage = useMemo(() => createCoverPage(), []);
  const [status, setStatus] = useState('');
  const today = todayInBay();
  const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 6); const weekEnd = end.toISOString().slice(0, 10);
  const nextPlans = library.data.plans.filter(plan => plan.date >= today).sort((a, b) => a.date.localeCompare(b.date) || b.updatedAt.localeCompare(a.updatedAt));
  const pastPlans = library.data.plans.filter(plan => plan.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const { preferences } = library.data;
  const thisWeek = useMemo(() => MONTHLY_EVENTS.filter(event => (!preferences.regions.length || preferences.regions.includes(event.region)) && (!preferences.interests.length || preferences.interests.includes(event.category)))
    .flatMap(event => { const date = nextConfirmedEventDate(event, today); return date && date <= weekEnd ? [{ event, date }] : []; })
    .sort((a, b) => a.date.localeCompare(b.date) || a.event.id.localeCompare(b.event.id)).slice(0, 6), [preferences.regions, preferences.interests, today, weekEnd]);
  const deletePlan = async (plan: SavedPlan) => {
    if (!await confirmDialog({ message: t('删除这份已保存计划？', 'Delete this saved plan?'), confirmText: t('删除', 'Delete'), cancelText: t('取消', 'Cancel'), danger: true })) return;
    if (await library.deletePlan(plan)) setStatus(t('计划已删除。', 'Plan deleted.'));
  };
  const disabled = library.busy || !library.ready;
  const toggle = (field: 'regions' | 'interests', id: string) => void library.savePreferences({ ...preferences, [field]: preferences[field].includes(id) ? preferences[field].filter(value => value !== id) : [...preferences[field], id] });
  const interests = [{ id: 'family', zh: '亲子', en: 'Family' }, { id: 'culture', zh: '文化', en: 'Culture' }, { id: 'outdoors', zh: '户外', en: 'Outdoors' }, { id: 'food', zh: '美食', en: 'Food' }];
  return <PageContainer size="content" className="my-week">
    {/* No header action: 这周可以去 below lists this week's events, and an empty saved list carries the page's one primary
        button (看本周末活动). That keeps the template inside the SYS bar of five button styles. */}
    <PageHeader title={t('我的这周', 'My Week')} lede={`${dayLabel(today, english)} – ${dayLabel(weekEnd, english)} · ${t('收藏和行程，都在这里', 'Your saved items and plans in one place')}`} />
    {!online && <p className="my-week__offline" role="status"><WifiOff aria-hidden="true" strokeWidth={1.75} />{t('你现在离线：下面是这台设备上已有的内容。联网后，行程和收藏会自动更新。', 'You are offline. What this device already has is shown below; your plans and saved items update when you reconnect.')}</p>}
    <div className="planner-page my-week__legacy"><PlannerAccountNotice variant="week" library={library} signedIn={signedIn} login={() => app?.setShowLogin(true)} /></div>

    <section id="plans" className="my-week__section" aria-labelledby="my-week-plans-title" data-testid="my-week-plans">
      <div className="my-week__head"><h2 id="my-week-plans-title"><CalendarDays aria-hidden="true" strokeWidth={1.75} />{t('行程', 'Plans')}</h2><Button variant="text" to="/plan">{t('再排一天', 'Plan another day')}</Button></div>
      {library.loading ? <SkeletonFeed rows count={2} />
        : !library.ready && library.error ? <ErrorState headingLevel="h3" homeTo={null} onRetry={() => void library.refresh()} title={t('暂时读不到你的行程', 'Your plans didn’t load')}
          body={online ? t('可能是网络不稳或服务繁忙。已保存的计划不会因此消失。', 'The connection or our service may be busy. Your saved plans are not lost.') : t('联网后再试一次。', 'Try again once you are back online.')} />
          : nextPlans.length ? <PlanTimeline plans={nextPlans} english={english} busy={disabled} onDelete={plan => void deletePlan(plan)} />
            : <p className="my-week__empty-line">{t('还没有安排哪天出门。在活动里点「加入这天计划」，就会排进这里。', 'No days planned yet. Tap “Add to this day’s plan” on an event and it lands here.')}</p>}
    </section>

    <UnifiedSavedItems today={today} signedIn={signedIn} coverPage={coverPage} />

    {app?.user && <div className="planner-page my-week__legacy">
      <MyWeekBookings user={app.user} onLoginNeeded={() => app?.setShowLogin(true)} plans={library.data.plans} plansReady={library.ready && !library.loading && !library.error} />
      <MyWeekOutings user={app.user} onLoginNeeded={() => app?.setShowLogin(true)} />
    </div>}

    <section id="this-week" className="my-week__section" aria-labelledby="my-week-events-title" data-testid="my-week-events">
      <div className="my-week__head"><h2 id="my-week-events-title">{t('这周可以去', 'This week')}</h2><Button variant="text" to="/calendar">{t('整月日历', 'Full month calendar')}</Button></div>
      {thisWeek.length ? <WeekEvents events={thisWeek} today={today} coverPage={coverPage} english={english} />
        : <p className="my-week__empty-line">{t('未来七天暂无符合偏好的已收录活动，可以放宽地区或兴趣。', 'No listed events match your areas and interests in the next seven days. Try widening them.')}</p>}
      <details className="my-week__prefs">
        <summary>{t('按我常去的地区和兴趣筛选', 'Filter by my areas and interests')}</summary>
        {!library.ready && library.error && <p className="my-week__note">{t('先重新读取资料，再调整出行偏好。', 'Reload your data before changing outing preferences.')}</p>}
        <ChipRow label={t('常去的地区', 'Areas I go to')}>{ATTRACTION_REGIONS.filter(region => region.id !== 'all').map(region => <FilterChip key={region.id} selected={preferences.regions.includes(region.id)} disabled={disabled} onClick={() => toggle('regions', region.id)}>{translateText(region.label, locale)}</FilterChip>)}</ChipRow>
        <ChipRow label={t('兴趣', 'Interests')}>{interests.map(interest => <FilterChip key={interest.id} selected={preferences.interests.includes(interest.id)} disabled={disabled} onClick={() => toggle('interests', interest.id)}>{t(interest.zh, interest.en)}</FilterChip>)}</ChipRow>
        <label className="my-week__select">{t('常用出行方式', 'Usual way to get around')}<select value={preferences.travelMode} disabled={disabled} onChange={event => void library.savePreferences({ ...preferences, travelMode: event.target.value })}>
          <option value="any">{t('暂未决定', 'Not decided')}</option><option value="drive">{t('开车', 'Drive')}</option><option value="transit">{t('公共交通', 'Transit')}</option><option value="walk">{t('步行', 'Walk')}</option>
        </select></label>
        <div className="planner-page my-week__legacy"><PlannerPreferenceMemory preferences={preferences} disabled={disabled} onSave={library.savePreferences} signedIn={signedIn} /></div>
      </details>
    </section>

    <div className="planner-page my-week__legacy"><ImportedEventsPanel userId={app?.user?.id} /></div>

    {pastPlans.length > 0 && <details className="my-week__prefs my-week__past">
      <summary>{t('过去的计划', 'Past plans')} <span className="my-week__count">{pastPlans.length}</span></summary>
      <ul>{pastPlans.map(plan => <li key={plan.id}><span><time dateTime={plan.date}>{dayLabel(plan.date, english)}</time> · <PlanTitle title={plan.title} locale={locale} /></span><Button variant="text" disabled={disabled} onClick={() => void deletePlan(plan)}>{t('删除计划', 'Delete plan')}</Button></li>)}</ul>
    </details>}
    {!signedIn && <details className="my-week__prefs">
      <summary>{t('账号功能：预约与小队', 'Account features: bookings and groups')}</summary>
      <p className="my-week__note">{t('登录后可查看服务预约、待办与已参加的小队；本机计划和收藏无需登录也能使用。', 'Sign in to see your service bookings, tasks and groups. Browser plans and saved items work without signing in.')}</p>
      <Button variant="secondary" onClick={() => app?.setShowLogin(true)}>{t('登录查看预约与小队', 'Sign in for bookings and groups')}</Button>
    </details>}
    <nav className="my-week__more" aria-label={t('更多活动灵感', 'More event ideas')}><Link to="/ai-in-the-bay">{t('看看湾区 AI 活动', 'Explore Bay Area AI events')}</Link></nav>
    {(status || library.error && library.ready) && <p className="my-week__note" role="status">{status || translateText(library.error, locale)}</p>}
  </PageContainer>;
}
