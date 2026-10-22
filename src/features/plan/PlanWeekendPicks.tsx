import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { EventCover, EventWhen } from '../../components/ui/Cover';
import { FeedCard } from '../../components/ui/Card';
import { FeedGrid, FeedItem } from '../../components/ui/FeedGrid';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import { coverItemFor, createCoverPage, getCover, type CoverPage, type ResolvedCover } from '../../lib/cover';
import { eventPlace, eventPriceChip, readerDayRange, readerMonthDay, type EventFactsInput } from '../../lib/event-facts';
import { getBayAreaToday } from '../../lib/monthly';
import snapshot from '../../data/generated/plan-weekend.json';
import type { PlanWeekendEvent, PlanWeekendSnapshot } from './plan-weekend-snapshot';

const PLAN_WEEKEND = snapshot as unknown as PlanWeekendSnapshot;
/** The strip's cards are the feed card's width: half the phone, a quarter of the 1180px container. */
const SIZES = '(max-width: 767px) calc(50vw - 22px), 286px';
/** The claimant the picks' photos carry in the page's cover registry: no item below matches it, so they show cards there. */
const CLAIMANT = 'plan-weekend-picks';

/** The event as a card prints it: in English, the generated English title, short title and place (the page has only the UI pack). */
function shown(event: PlanWeekendEvent, english: boolean): EventFactsInput {
  const facts = event as unknown as EventFactsInput;
  return english ? { ...facts, title: event.en.title, shortTitle: event.en.shortTitle, venueShort: event.en.place } : facts;
}

/**
 * Line 2 as on every event card (DECISIONS 20; EventCards.tsx EventStatusLine): 免费 and 部分免费 in the one status map's
 * look (STATUS_TONE), a price as plain text, then the place. The markup, not EventCards, so /plan does not load the events
 * card module.
 */
const STATUS_TONE: Record<string, string> = { free: 'free', mixed: 'partial' };

/**
 * H54 (WEB-PERF-3): 行程 opens with pictures, not a form. This weekend's picks, the home page's snapshot for the day (the
 * home's 本周末先看这几件, then its weekend list; plan-weekend-snapshot.ts): up to four feed cards with the date on the
 * photo and the place and price under it, each opening its event (where 加入这天计划 adds it to a day). Two on a phone, one
 * at 大/特大 and in 简洁显示, four on a desktop (plan-page.css). Nothing on a day past the snapshots (no rebuild for four
 * weeks): the planner then starts at once. The block is a `weekend` date scope (lib/date-guard.ts), written out here so the
 * page does not share a chunk with the home page for one attribute.
 */
export function PlanWeekendPicks({ coverPage, onCovers }: { coverPage?: CoverPage; onCovers?: (covers: readonly ResolvedCover[]) => void }) {
  const { t, pick, locale, english } = useUiCopy();
  const [today] = useState(getBayAreaToday);
  const picks = useMemo(() => {
    const day = PLAN_WEEKEND.days[today];
    if (!day) return null;
    // A photo the workspace below already shows (the strip coming back after a plan's last stop goes) is not shown again.
    const page = createCoverPage();
    if (coverPage) for (const [src, claimant] of coverPage.claims) if (claimant !== CLAIMANT) page.claims.set(src, 'plan-workspace');
    const context = { images: PLAN_WEEKEND.images, today, page };
    const entries = day.entries.flatMap(({ id, date }) => {
      const event = PLAN_WEEKEND.events[id];
      return event ? [{ event, date, cover: getCover(coverItemFor('event', { ...event, id }), context) }] : [];
    });
    return entries.length ? { ...day, entries } : null;
  }, [today, coverPage]);
  // VISUAL-10: the picks come first on the page, so their photos are claimed before the workspace resolves its covers (in
  // the same render, as the workspace claims during render); the claims go when the picks do (a plan opened below).
  const photos = useMemo(() => picks?.entries.flatMap(({ cover }) => cover.tier === 'type' ? [] : [cover.image.src]) ?? [], [picks]);
  if (coverPage) for (const src of photos) if (!coverPage.claims.has(src)) coverPage.claims.set(src, CLAIMANT);
  useEffect(() => () => { if (coverPage) for (const src of photos) if (coverPage.claims.get(src) === CLAIMANT) coverPage.claims.delete(src); }, [coverPage, photos]);
  // The page's 本页图片来源 lists these pictures too (PlannerPage hands them to the workspace's credits).
  useEffect(() => { onCovers?.(picks?.entries.map(({ cover }) => cover) ?? []); return () => onCovers?.([]); }, [picks, onCovers]);
  if (!picks) return null;
  // "10/17–18" / "Oct 17–18", as the home's weekend heading (features/home/home-model.ts weekendRange) and the cards' stickers.
  const range = picks.start === picks.end ? readerMonthDay(picks.start, english) : readerDayRange(picks.start, picks.end, english);
  // The page's one eager image is the first pick's picture.
  const eager = picks.entries.findIndex(({ cover }) => cover.tier !== 'type');
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
          <FeedCard title={facts.shortTitle || facts.title} to={`/events/${event.id}?date=${date}`}
            cover={<EventCover event={facts} cover={cover} today={today} days={[date]} sizes={SIZES} priority={index === eager} decorative />}
            when={<EventWhen event={facts} today={today} days={[date]} />} meta={<>{price && <span className={STATUS_TONE[price.tone] ? 'ui-status' : 'ui-meta-price'} data-tone={STATUS_TONE[price.tone]}>{pick(price.text)}</span>}{price && <span className="ui-meta-sep">{'\u00a0· '}</span>}<span className="ui-meta-place">{translateText(eventPlace(facts), locale)}</span></>} />
        </FeedItem>;
      })}
    </FeedGrid>
  </section>;
}
