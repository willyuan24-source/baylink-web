import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EventCover, HeroCard } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { AddToDayPlan } from '../../components/AddToDayPlan';
import { SaveToWeek } from '../../components/SaveToWeek';
import { translateText } from '../../i18n/locale';
import type { ResolvedCover } from '../../lib/cover';
import { eventDateChip, eventPlace, eventPriceChip, eventTimeLabel, formatDateChip, type EventFactsInput } from '../../lib/event-facts';
import type { HomeEvent } from '../../lib/home-catalog';
import type { HomeWeekendPick } from '../../lib/home-weekend';
import { monthDay, REGION_LABELS, weekendRange } from './home-model';

/** Phones take the 800w rung at most for a 358px card (as /events' picks, RC-33); desktop's 4:5 lead is 380px wide. */
const PICK_SIZES = '(max-width: 767px) 266px, (max-width: 1023px) 45vw, 380px';
const facts = (event: HomeEvent) => event as unknown as EventFactsInput;

/** One pick: the 4:5 cover story with date, time and price on the photo, the editor's reason, the source check, ♡ and 加入这天计划. */
function PickCard({ pick, cover, today, priority }: { pick: HomeWeekendPick; cover: ResolvedCover; today: string; priority: boolean }) {
  const { english, pick: copy, t, locale } = useUiCopy();
  const event = pick.event as HomeEvent;
  const chip = formatDateChip(eventDateChip(facts(event), today, [pick.date]), english);
  const time = eventTimeLabel(facts(event), pick.date, english);
  const price = eventPriceChip(facts(event));
  const region = copy(REGION_LABELS[event.region]);
  const city = translateText(eventPlace(facts(event)), locale);
  return <div className="home-pick">
    <HeroCard title={event.title} to={`/events/${event.id}?date=${pick.date}`} heading="h3" overlay={cover.tier !== 'type'}
      cover={<EventCover event={facts(event)} cover={cover} today={today} days={[pick.date]} ratio="4:5" ratioLock priority={priority} sizes={PICK_SIZES} decorative />}
      kicker={city === region || event.region === 'sf' && event.city === 'San Francisco' ? region : `${city} · ${region}`}
      facts={[[chip.label, time].filter(Boolean).join(' · '), ...(price ? [copy(price.text)] : [])]}
      reason={pick.editorial ? { label: t('编辑推荐', 'Editor’s pick'), text: copy(pick.editorial.reason) } : undefined}
      trust={<>{t('官网核对', 'Source checked')} {monthDay(event.verifiedAt)}</>}
      save={<SaveToWeek favorite={{ kind: 'event', id: event.id }} compact title={event.title} />} />
    {/* FC3-01: the same control as /calendar and My Week, which saves into that day's plan at once. */}
    <AddToDayPlan stop={{ kind: 'event', id: event.id }} date={pick.date} title={event.title} today={today} compact className="home-pick__plan" />
  </div>;
}

/**
 * ② This weekend's picks (1007 §4.2 ②): the weekly share card's three, editor's choice first. A swipeable 4:5 rail on
 * phones (the next card peeks), the cover mosaic beside the headline on desktop (one 4:5 lead and two smaller covers).
 * `total` is null when the home cannot count the weekend (a day past its snapshots): then no number and no "nothing
 * this weekend" sentence, only the way to /events, which reads the whole catalog.
 */
export function HeroPicks({ picks, covers, today, start, end, total }: { picks: readonly HomeWeekendPick[]; covers: readonly ResolvedCover[]; today: string; start: string; end: string; total: number | null }) {
  const { t } = useUiCopy();
  return <section className="home-picks" aria-labelledby="home-picks-title">
    <div className="home-section-head">
      {/* The separator keeps the heading's name readable ("本周末先看这几件，10/17–18"); the date shows as a kicker. */}
      <h2 id="home-picks-title">{t('本周末先看这几件', 'This weekend, start here')}<span className="sr-only">{t('，', ', ')}</span><span className="home-section-head__kicker">{weekendRange(start, end)}</span></h2>
      <Link to="/events" className="home-section-head__more">{total === null ? t('全部活动', 'All events') : t(`全部 ${total} 场`, `All ${total}`)}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div>
    {picks.length ? <ul className="home-picks__list" aria-label={t('本周末精选', 'This weekend’s picks')}>
      {picks.map((pick, index) => <li key={pick.event.id}><PickCard pick={pick} cover={covers[index]} today={today} priority={index === 0} /></li>)}
    </ul> : total === null ? <div className="home-empty">
      <Link to="/events">{t('看本周末全部活动', 'See all events this weekend')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div> : <div className="home-empty">
      <p>{t('这个周末暂没有已确认的活动，先看常设去处或换个日期。', 'No confirmed events for this weekend yet. Try a year-round place or another date.')}</p>
      <Link to="/explore">{t('按地区找景点', 'Explore places')}</Link>
    </div>}
  </section>;
}
