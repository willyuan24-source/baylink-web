import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EventCover, FeedCard } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SaveToWeek } from '../../components/SaveToWeek';
import type { ResolvedCover } from '../../lib/cover';
import { eventWhenLine, type EventFactsInput } from '../../lib/event-facts';
import type { HomeEvent } from '../../lib/home-catalog';
import type { HomeWeekendPick } from '../../lib/home-weekend';
import { METHOD_HREF, OFFICIAL_LINKS, officialCheckLine, type CheckSummary } from '../../lib/check-dates';
import { checkedLine, weekendRange } from './home-model';
import { EventMeta } from './WeekendFeed';
import { dateScope } from '../../lib/date-guard';

/**
 * The lead fills a phone's width less the 16px gutters (16:9, about 358px at 390) and columns 6–12 on a desktop (≈700px);
 * picks 2–3 are half a phone, three columns. `sizes` states the slot's real width (UI9-IMG-A1b, captain 10-21: it said 266px
 * on a 358px slot), and the prerendered LCP preload copies it, so the two always ask for the same rung.
 */
const LEAD_SIZES = '(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) 100vw, 700px';
const PICK_SIZES = '(max-width: 1023px) 50vw, 290px';
const facts = (event: HomeEvent) => event as unknown as EventFactsInput;
const weekend = dateScope('weekend');
/** The trust line names one day: the one most items were checked (多数), or the day all were. */
const mostlyDay = ({ mostly, all }: CheckSummary): CheckSummary => ({ mostly, latest: mostly, earliest: mostly, all: all === true });
/** A date never breaks from the word before it ("mostly Oct 15", "多数 10/15"): the space before a digit does not wrap. */
const glueDates = (text: string) => text.replace(/ (?=\d)/g, '\u00a0');

/** One pick (one card anatomy, FeedCard): the cover, the title, line 1 (the whole time window), line 2 (status · place), ✓, ♡. */
function PickCard({ pick, cover, today, lead }: { pick: HomeWeekendPick; cover: ResolvedCover; today: string; lead: boolean }) {
  const { english, pick: copy, t } = useUiCopy();
  const event = pick.event as HomeEvent;
  return <>
    <FeedCard title={event.title} to={`/events/${event.id}?date=${pick.date}`}
      cover={<EventCover event={facts(event)} cover={cover} today={today} days={[pick.date]} ratio="3:2" priority={lead} sizes={lead ? LEAD_SIZES : PICK_SIZES} decorative />}
      when={copy(eventWhenLine(facts(event), today, [pick.date]))} meta={<EventMeta event={event} />}
      trust={checkedLine(event.verifiedAt, event.press, t, english)}
      save={<SaveToWeek favorite={{ kind: 'event', id: event.id }} compact title={event.title} />} />
    {/* The editor's reason shows under each pick on a desktop (home-discovery.css). */}
    {pick.editorial && <p className="home-pick__reason">{t('编辑推荐：', 'Editor’s pick: ')}{copy(pick.editorial.reason)}</p>}
  </>;
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
  return <section className="home-picks" role="region" aria-labelledby="home-picks-title">
    {/* The date guard covers each block of the picks, not the section: on a desktop the section and its list are
        display:contents (home-discovery.css), so a skeleton on the section would have no box of its own to fill. */}
    <div className="home-section-head" {...weekend}>
      {/* The separator keeps the heading's name readable ("本周末先看这几件，10/24–25"); the date shows as a kicker. */}
      <h2 id="home-picks-title">{t('本周末先看这几件', 'This weekend, start here')}<span className="sr-only">{t('，', ', ')}</span><span className="home-section-head__kicker">{weekendRange(start, end, english)}</span></h2>
    </div>
    {picks.length ? <ul className="home-picks__list" role="list" aria-label={t('本周末精选', 'This weekend’s picks')}>
      {picks.map((item, index) => <li key={item.event.id} {...weekend}><PickCard pick={item} cover={covers[index]} today={today} lead={index === 0} /></li>)}
    </ul> : <div className="home-empty" {...weekend}>
      {/* The lead's slot holds a text panel when there is nothing to show: none confirmed (0), or no picks for a day the
          build did not cover (the count is unknown then, so no number). */}
      <p>{total === 0 ? t('这个周末暂没有已确认的活动，先看常设去处或换个日期。', 'No confirmed events for this weekend yet. Try a year-round place or another date.')
        : t('本周末的精选还没排好，先看全部活动或日历。', 'This weekend’s picks are not ready yet. See all events or the calendar.')}</p>
      <Link to="/calendar" className="home-section-head__more">{t('看日历', 'Calendar')}</Link>
      <Link to="/explore" className="home-section-head__more">{t('按地区找景点', 'Explore places')}</Link>
    </div>}
    <Link to="/events" className="home-section-head__more home-picks__all" {...weekend}>{total ? t(`看本周末全部 ${total} 场`, `See all ${total} this weekend`) : t('看本周末全部活动', 'See all events this weekend')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    {/* "✓ 多数 10/15 官网核对": the day most were checked, without the latest one; the separator stays with the phrase
        before it, so a wrapped line starts with 我们怎么核对 →, never with "·". */}
    <p className="home-trust" {...weekend}><span aria-hidden="true">✓ </span>{pick(OFFICIAL_LINKS)}{checked && <> · <span aria-hidden="true">✓ </span>{glueDates(officialCheckLine(mostlyDay(checked), t, { order: 'trail' }))}</>}{'\u00a0· '}<Link to={METHOD_HREF}>{t('我们怎么核对', 'How we check')}<span aria-hidden="true"> →</span></Link></p>
  </section>;
}
