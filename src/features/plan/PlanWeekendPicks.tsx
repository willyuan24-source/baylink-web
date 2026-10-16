import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { EventCover } from '../../components/ui/Cover';
import { FeedCard } from '../../components/ui/Card';
import { FeedGrid, FeedItem } from '../../components/ui/FeedGrid';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import { createCoverPage, getCover, type CoverPage } from '../../lib/cover';
import { dateScope } from '../../lib/date-guard';
import { eventPlace, eventPriceChip, type EventFactsInput } from '../../lib/event-facts';
import { GUIDE_IMAGES, type HomeEvent } from '../../lib/home-catalog';
import { getHomeWeekend } from '../../lib/home-weekend';
import { getBayAreaToday } from '../../lib/monthly';

/** Up to four: two on a phone (one row above the planner; one at 大/特大 and in 简洁显示), four in one row from 768px (plan-page.css). */
const SHOWN = 4;
/** The strip's cards are the feed card's width: half the phone, a quarter of the 1180px container. */
const SIZES = '(max-width: 767px) calc(50vw - 22px), 286px';
const facts = (event: HomeEvent) => event as unknown as EventFactsInput;
const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
/** The claimant the picks' photos carry in the page's cover registry: no item below matches it, so they show cards there. */
const CLAIMANT = 'plan-weekend-picks';

/**
 * H54 (WEB-PERF-3): 行程 opens with pictures, not a form. This weekend's picks, the same snapshot and order as the home
 * page's 本周末先看这几件 (getHomeWeekend), then the rest of its weekend list: two-column covers with the date on the photo,
 * place and price under it, each opening the event (where 加入这天计划 adds it to a day). Nothing when the weekend has no
 * events the home catalog knows (a day past its snapshots): the planner then starts at once.
 */
export function PlanWeekendPicks({ coverPage }: { coverPage?: CoverPage }) {
  const { t, pick, locale } = useUiCopy();
  const [today] = useState(getBayAreaToday);
  const picks = useMemo(() => {
    const weekend = getHomeWeekend(today);
    const entries = [...weekend.picks, ...weekend.feed].slice(0, SHOWN);
    const context = { images: GUIDE_IMAGES, today, page: createCoverPage() };
    return { start: weekend.start, end: weekend.end, entries: entries.map(entry => ({ ...entry, event: entry.event as HomeEvent, cover: getCover({ kind: 'event', id: entry.event.id, imageKey: (entry.event as HomeEvent).imageKey }, context) })) };
  }, [today]);
  // VISUAL-10: the picks come first on the page, so their photos are claimed before the workspace resolves its covers (in
  // the same render, as the workspace claims during render); the claims go when the picks do (a plan opened below).
  const photos = useMemo(() => picks.entries.flatMap(({ cover }) => cover.tier === 'type' ? [] : [cover.image.src]), [picks]);
  if (coverPage) for (const src of photos) if (!coverPage.claims.has(src)) coverPage.claims.set(src, CLAIMANT);
  useEffect(() => () => { if (coverPage) for (const src of photos) if (coverPage.claims.get(src) === CLAIMANT) coverPage.claims.delete(src); }, [coverPage, photos]);
  if (!picks.entries.length) return null;
  // "10/17–18" / "10/31–11/1", as the home's weekend heading (features/home/home-model.ts weekendRange).
  const range = picks.start === picks.end ? monthDay(picks.start)
    : picks.start.slice(0, 7) === picks.end.slice(0, 7) ? `${monthDay(picks.start)}–${Number(picks.end.slice(8, 10))}` : `${monthDay(picks.start)}–${monthDay(picks.end)}`;
  return <section className="plan-weekend" aria-labelledby="plan-weekend-title" {...dateScope('weekend')}>
    <div className="home-section-head">
      <h2 id="plan-weekend-title">{t('本周末精选', 'This weekend’s picks')}<span className="sr-only">{t('，', ', ')}</span><span className="home-section-head__kicker">{range}</span></h2>
      <Link to="/events" className="home-section-head__more">{t('全部活动', 'All events')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div>
    <FeedGrid label={t('本周末精选', 'This weekend’s picks')}>
      {picks.entries.map(({ event, date, cover }, index) => {
        const price = eventPriceChip(facts(event));
        return <FeedItem key={event.id}>
          <FeedCard title={event.title} to={`/events/${event.id}?date=${date}`}
            cover={<EventCover event={facts(event)} cover={cover} today={today} days={[date]} sizes={SIZES} priority={index === 0} decorative />}
            meta={<><span className="ui-meta-place">{translateText(eventPlace(facts(event)), locale)}</span>{price && <span className="ui-meta-price"><span className="ui-meta-sep"> · </span>{price.tone === 'free' ? <strong>{pick(price.text)}</strong> : pick(price.text)}</span>}</>} />
        </FeedItem>;
      })}
    </FeedGrid>
  </section>;
}
