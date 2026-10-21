import { Button, EventCover, FeedCard, FeedGrid, FeedItem, useFeedLayout } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SaveToWeek } from '../../components/SaveToWeek';
import { translateText } from '../../i18n/locale';
import type { ResolvedCover } from '../../lib/cover';
import { eventPlace, eventPriceChip, eventWhenLine, type EventFactsInput } from '../../lib/event-facts';
import type { HomeEvent } from '../../lib/home-catalog';
import { checkedLine } from './home-model';
import { Home3DStrip } from './Home3DStrip';
import { dateScope } from '../../lib/date-guard';

export type FeedEntry = { event: HomeEvent; date: string };
/** The 3D strip follows this many cards: two full rows on a phone, one on a desktop (H36). */
const STRIP_AFTER = 4;
const FEED_SIZES = '(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 290px';
const facts = (event: HomeEvent) => event as unknown as EventFactsInput;

/**
 * Line 2 of a home event card (G18): the status in the one status look (C's .ui-status[data-tone]: 免费, 部分免费) or the
 * price, then the place. It wraps and is never cut. The look is drawn with the status map's classes, not StatusChip, which
 * would add its module to the home's JS (+0.6 KiB gzip); UI9-INT may switch it once it allocates the room.
 */
export function EventMeta({ event }: { event: HomeEvent }) {
  const { pick, locale } = useUiCopy();
  const price = eventPriceChip(facts(event));
  const place = translateText(eventPlace(facts(event)), locale);
  if (!price) return <>{place}</>;
  const text = pick(price.text);
  return <>{price.tone === 'free' || price.tone === 'mixed' ? <span className="ui-status" data-tone={price.tone === 'free' ? 'free' : 'partial'}>{text}</span> : text} · {place}</>;
}

/**
 * ④ The rest of this weekend (1007 §4.2 ④, D9): eight 3:2 covers two-up (four-up on a desktop), the time window, status ·
 * place, the source check and ♡ 收藏 (FC3-02: the one save model). After the first four cards, the 3D San Francisco strip
 * (H36). Ends with one button to the whole weekend (without a number when the home cannot count it). At 大 / 特大 the
 * cards are rows and six show; in 简洁 only the strip stays (home-discovery.css).
 */
export function WeekendFeed({ feed, covers, today, total }: { feed: readonly FeedEntry[]; covers: readonly ResolvedCover[]; today: string; total: number | null }) {
  const { t, english, pick } = useUiCopy();
  const { layout } = useFeedLayout();
  if (!feed.length) return null;
  return <section className="home-feed" aria-labelledby="home-feed-title" {...dateScope('weekend')}>
    <div className="home-section-head" data-simple="hide"><h2 id="home-feed-title">{t('本周末还有', 'More this weekend')}</h2></div>
    <FeedGrid label={t('本周末活动', 'Events this weekend')} layout={layout}>
      {feed.flatMap(({ event, date }, index) => [<FeedItem key={event.id}>
        <FeedCard title={event.title} to={`/events/${event.id}?date=${date}`}
          cover={<EventCover event={facts(event)} cover={covers[index]} today={today} days={[date]} ratio="3:2" sizes={FEED_SIZES} decorative />}
          when={pick(eventWhenLine(facts(event), today, [date]))} meta={<EventMeta event={event} />} trust={checkedLine(event.verifiedAt, event.press, t, english)}
          save={<SaveToWeek favorite={{ kind: 'event', id: event.id }} compact title={event.title} />} />
      </FeedItem>, ...(index === Math.min(STRIP_AFTER, feed.length) - 1 ? [<FeedItem key="home-3d-strip" wide><Home3DStrip /></FeedItem>] : [])])}
    </FeedGrid>
    {(total === null || total > feed.length) && <Button variant="secondary" block to="/events" className="home-feed__all" data-simple="hide">
      {total === null ? t('看本周末全部活动', 'See all events this weekend') : t(`看本周末全部 ${total} 场`, `See all ${total} events this weekend`)}
    </Button>}
  </section>;
}
