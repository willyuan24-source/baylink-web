import { Button, EventCover, FeedCard, FeedGrid, FeedItem, useFeedLayout } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SaveToWeek } from '../../components/SaveToWeek';
import { translateText } from '../../i18n/locale';
import type { ResolvedCover } from '../../lib/cover';
import { eventPlace, eventPriceChip, eventWhenLine, type EventFactsInput } from '../../lib/event-facts';
import type { HomeEvent } from '../../lib/home-catalog';
import { monthDay } from './home-model';
import { Home3DStrip } from './Home3DStrip';
import { dateScope } from '../../lib/date-guard';

export type FeedEntry = { event: HomeEvent; date: string };
/** The 3D strip follows this many cards: two full rows on a phone, one on a desktop (H36). */
const STRIP_AFTER = 4;
const facts = (event: HomeEvent) => event as unknown as EventFactsInput;

/** "Berkeley · 免费" (free in brand 600), or the place alone when the cost is unknown. */
function EventMeta({ event }: { event: HomeEvent }) {
  const { pick, locale } = useUiCopy();
  const price = eventPriceChip(facts(event));
  // The place gives way (ellipsis) before the price does: "Old Courthouse Square · 部分免费", never "… · 部…".
  return <><span className="ui-meta-place">{translateText(eventPlace(facts(event)), locale)}</span>{price && <span className="ui-meta-price"><span className="ui-meta-sep"> · </span>{price.tone === 'free' ? <strong>{pick(price.text)}</strong> : pick(price.text)}</span>}</>;
}

/**
 * ④ The rest of this weekend (1007 §4.2 ④, D9): a two-column cover feed of eight, the date on the photo, place and price
 * under it, the source check and ♡ 收藏 (FC3-02: the one save model, as on /events). One column at 大/特大 and in 简洁显示
 * on phones (FeedGrid). After the first four cards, the 3D San Francisco strip (H36: the 3D entry at about a third of the
 * page, not only at its end). Ends with one button to the whole weekend (without a number when the home cannot count it).
 */
export function WeekendFeed({ feed, covers, today, total }: { feed: readonly FeedEntry[]; covers: readonly ResolvedCover[]; today: string; total: number | null }) {
  const { t, english, pick } = useUiCopy();
  const { layout } = useFeedLayout();
  if (!feed.length) return null;
  return <section className="home-feed" aria-labelledby="home-feed-title" {...dateScope('weekend')}>
    <div className="home-section-head"><h2 id="home-feed-title">{t('本周末还有', 'More this weekend')}</h2></div>
    <FeedGrid label={t('本周末活动', 'Events this weekend')} layout={layout}>
      {feed.flatMap(({ event, date }, index) => [<FeedItem key={event.id}>
        <FeedCard title={event.title} to={`/events/${event.id}?date=${date}`}
          cover={<EventCover event={facts(event)} cover={covers[index]} today={today} days={[date]} decorative />}
          when={pick(eventWhenLine(facts(event), today, [date]))} meta={<EventMeta event={event} />} trust={<>{t('官网核对', 'Source checked')} {monthDay(event.verifiedAt, english)}</>}
          save={<SaveToWeek favorite={{ kind: 'event', id: event.id }} compact title={event.title} />} />
      </FeedItem>, ...(index === Math.min(STRIP_AFTER, feed.length) - 1 ? [<FeedItem key="home-3d-strip" wide><Home3DStrip /></FeedItem>] : [])])}
    </FeedGrid>
    {(total === null || total > feed.length) && <Button variant="secondary" block to="/events" className="home-feed__all">
      {total === null ? t('看本周末全部活动', 'See all events this weekend') : t(`看本周末全部 ${total} 场`, `See all ${total} events this weekend`)}
    </Button>}
  </section>;
}
