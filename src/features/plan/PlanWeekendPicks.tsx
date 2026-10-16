import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { EventCover } from '../../components/ui/Cover';
import { FeedCard } from '../../components/ui/Card';
import { FeedGrid, FeedItem } from '../../components/ui/FeedGrid';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import { createCoverPage, getCover, type CoverPage } from '../../lib/cover';
import { eventPlace, eventPriceChip, type EventFactsInput } from '../../lib/event-facts';
import { getBayAreaToday } from '../../lib/monthly';
import snapshot from '../../data/generated/plan-weekend.json';
import type { PlanWeekendEvent, PlanWeekendSnapshot } from './plan-weekend-snapshot';

const PLAN_WEEKEND = snapshot as unknown as PlanWeekendSnapshot;
/** The strip's cards are the feed card's width: half the phone, a quarter of the 1180px container. */
const SIZES = '(max-width: 767px) calc(50vw - 22px), 286px';
const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
/** The claimant the picks' photos carry in the page's cover registry: no item below matches it, so they show cards there. */
const CLAIMANT = 'plan-weekend-picks';

/** The event as a card prints it: in English, the generated English title, short title and place (the page has only the UI pack). */
function shown(event: PlanWeekendEvent, english: boolean): EventFactsInput {
  const facts = event as unknown as EventFactsInput;
  return english ? { ...facts, title: event.en.title, shortTitle: event.en.shortTitle, venueShort: event.en.place } : facts;
}

/**
 * H54 (WEB-PERF-3): 行程 opens with pictures, not a form. This weekend's picks, the home page's snapshot for the day (the
 * home's 本周末先看这几件, then its weekend list; plan-weekend-snapshot.ts): up to four feed cards with the date on the
 * photo and the place and price under it, each opening its event (where 加入这天计划 adds it to a day). Two on a phone, one
 * at 大/特大 and in 简洁显示, four on a desktop (plan-page.css). Nothing on a day past the snapshots (no rebuild for four
 * weeks): the planner then starts at once. The block is a `weekend` date scope (lib/date-guard.ts), written out here so the
 * page does not share a chunk with the home page for one attribute.
 */
export function PlanWeekendPicks({ coverPage }: { coverPage?: CoverPage }) {
  const { t, pick, locale, english } = useUiCopy();
  const [today] = useState(getBayAreaToday);
  const picks = useMemo(() => {
    const day = PLAN_WEEKEND.days[today];
    if (!day) return null;
    const context = { images: PLAN_WEEKEND.images, today, page: createCoverPage() };
    const entries = day.entries.flatMap(({ id, date }) => {
      const event = PLAN_WEEKEND.events[id];
      return event ? [{ event, date, cover: getCover({ kind: 'event', id, imageKey: event.imageKey }, context) }] : [];
    });
    return entries.length ? { ...day, entries } : null;
  }, [today]);
  // VISUAL-10: the picks come first on the page, so their photos are claimed before the workspace resolves its covers (in
  // the same render, as the workspace claims during render); the claims go when the picks do (a plan opened below).
  const photos = useMemo(() => picks?.entries.flatMap(({ cover }) => cover.tier === 'type' ? [] : [cover.image.src]) ?? [], [picks]);
  if (coverPage) for (const src of photos) if (!coverPage.claims.has(src)) coverPage.claims.set(src, CLAIMANT);
  useEffect(() => () => { if (coverPage) for (const src of photos) if (coverPage.claims.get(src) === CLAIMANT) coverPage.claims.delete(src); }, [coverPage, photos]);
  if (!picks) return null;
  // "10/17–18" / "10/31–11/1", as the home's weekend heading (features/home/home-model.ts weekendRange).
  const range = picks.start === picks.end ? monthDay(picks.start)
    : picks.start.slice(0, 7) === picks.end.slice(0, 7) ? `${monthDay(picks.start)}–${Number(picks.end.slice(8, 10))}` : `${monthDay(picks.start)}–${monthDay(picks.end)}`;
  return <section className="plan-weekend" aria-labelledby="plan-weekend-title" data-date-scope="weekend">
    <div className="home-section-head">
      <h2 id="plan-weekend-title">{t('本周末精选', 'This weekend’s picks')}<span className="sr-only">{t('，', ', ')}</span><span className="home-section-head__kicker">{range}</span></h2>
      <Link to="/events" className="home-section-head__more">{t('全部活动', 'All events')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div>
    <FeedGrid label={t('本周末精选', 'This weekend’s picks')}>
      {picks.entries.map(({ event, date, cover }, index) => {
        const facts = shown(event, english);
        const price = eventPriceChip(facts);
        return <FeedItem key={event.id}>
          <FeedCard title={facts.title} to={`/events/${event.id}?date=${date}`}
            cover={<EventCover event={facts} cover={cover} today={today} days={[date]} sizes={SIZES} priority={index === 0} decorative />}
            meta={<><span className="ui-meta-place">{translateText(eventPlace(facts), locale)}</span>{price && <span className="ui-meta-price"><span className="ui-meta-sep"> · </span>{price.tone === 'free' ? <strong>{pick(price.text)}</strong> : pick(price.text)}</span>}</>} />
        </FeedItem>;
      })}
    </FeedGrid>
  </section>;
}
