import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EventCover, HeroCard } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SaveToWeek } from '../../components/SaveToWeek';
import type { ResolvedCover } from '../../lib/cover';
import { eventWhenLine, type EventFactsInput } from '../../lib/event-facts';
import type { HomeEvent } from '../../lib/home-catalog';
import type { HomeWeekendPick } from '../../lib/home-weekend';
import { METHOD_HREF, OFFICIAL_LINKS, officialCheckLine, type CheckSummary } from '../../lib/check-dates';
import { monthDay, weekendRange } from './home-model';
import { EventMeta } from './WeekendFeed';
import { dateScope } from '../../lib/date-guard';

/** The lead fills a phone's width (16:9) and columns 6–12 on a desktop (≈700px); picks 2–3 are half a phone, three columns. */
const LEAD_SIZES = '(max-width: 1023px) 100vw, 700px';
const PICK_SIZES = '(max-width: 1023px) 50vw, 290px';
const facts = (event: HomeEvent) => event as unknown as EventFactsInput;

/** One pick: the cover, then the title, line 1 (the whole time window), line 2 (status · place), the editor's reason, ✓. */
function PickCard({ pick, cover, today, lead }: { pick: HomeWeekendPick; cover: ResolvedCover; today: string; lead: boolean }) {
  const { english, pick: copy, t } = useUiCopy();
  const event = pick.event as HomeEvent;
  return <HeroCard title={event.title} to={`/events/${event.id}?date=${pick.date}`} heading="h3" overlay={false}
    cover={<EventCover event={facts(event)} cover={cover} today={today} days={[pick.date]} ratio="3:2" priority={lead} sizes={lead ? LEAD_SIZES : PICK_SIZES} decorative />}
    when={copy(eventWhenLine(facts(event), today, [pick.date]))} meta={<EventMeta event={event} />}
    reason={pick.editorial ? { label: t('编辑推荐', 'Editor’s pick'), text: copy(pick.editorial.reason) } : undefined}
    trust={<>{t('官网核对', 'Source checked')} {monthDay(event.verifiedAt, english)}</>}
    save={<SaveToWeek favorite={{ kind: 'event', id: event.id }} compact title={event.title} />} />;
}

/**
 * ② This weekend's picks (UI9-HOME content arrangement): the weekly share card's three in their order (EVENTS' homeLeads
 * keys off the first). The lead is 16:9 (full-bleed on a phone), picks 2–3 a 2-up row; then 看本周末全部 N 场 and the
 * trust line. On a desktop the lead takes columns 6–12 beside the masthead, picks 2–3 columns 1–6 below it, and the trust
 * line the masthead column (home-discovery.css); at 大 / 特大 and in 简洁 the cards turn into rows (CSS only). `total` is
 * null when the home cannot count the weekend: then no number, only the way to /events.
 */
export function HeroPicks({ picks, covers, today, start, end, total, checked }: { picks: readonly HomeWeekendPick[]; covers: readonly ResolvedCover[]; today: string; start: string; end: string; total: number | null; checked: CheckSummary | null }) {
  const { t, english, pick } = useUiCopy();
  return <section className="home-picks" aria-labelledby="home-picks-title" {...dateScope('weekend')}>
    <div className="home-section-head">
      {/* The separator keeps the heading's name readable ("本周末先看这几件，10/24–25"); the date shows as a kicker. */}
      <h2 id="home-picks-title">{t('本周末先看这几件', 'This weekend, start here')}<span className="sr-only">{t('，', ', ')}</span><span className="home-section-head__kicker">{weekendRange(start, end, english)}</span></h2>
    </div>
    {picks.length ? <ul className="home-picks__list" aria-label={t('本周末精选', 'This weekend’s picks')}>
      {picks.map((item, index) => <li key={item.event.id}><PickCard pick={item} cover={covers[index]} today={today} lead={index === 0} /></li>)}
    </ul> : total === 0 ? <div className="home-empty">
      <p>{t('这个周末暂没有已确认的活动，先看常设去处或换个日期。', 'No confirmed events for this weekend yet. Try a year-round place or another date.')}</p>
      <Link to="/calendar">{t('看日历', 'Calendar')}</Link>
      <Link to="/explore">{t('按地区找景点', 'Explore places')}</Link>
    </div> : null}
    <Link to="/events" className="home-section-head__more home-picks__all">{total ? t(`看本周末全部 ${total} 场`, `See all ${total} this weekend`) : t('看本周末全部活动', 'See all events this weekend')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    <p className="home-trust"><span><Check aria-hidden="true" strokeWidth={1.75} />{pick(OFFICIAL_LINKS)}</span>{checked && <> · <span><Check aria-hidden="true" strokeWidth={1.75} />{officialCheckLine(checked, t, { order: 'trail' })}</span></>} · <Link to={METHOD_HREF}>{t('我们怎么核对', 'How we check')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link></p>
  </section>;
}
