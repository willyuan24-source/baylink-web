import { Button, EventCover, FeedCard, FeedGrid, FeedItem, useFeedLayout } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SaveToWeek } from '../../components/SaveToWeek';
import { translateText } from '../../i18n/locale';
import type { ResolvedCover } from '../../lib/cover';
import { eventPlace, eventPriceChip, type CoverTone, type EventFactsInput } from '../../lib/event-facts';
import type { HomeEvent } from '../../lib/home-catalog';
import { monthDay } from './home-model';

export type FeedEntry = { event: HomeEvent; date: string };
const facts = (event: HomeEvent) => event as unknown as EventFactsInput;

/** "Berkeley · 免费" (free in brand 600), or the place alone when the cost is unknown. */
function EventMeta({ event }: { event: HomeEvent }) {
  const { pick, locale } = useUiCopy();
  const price = eventPriceChip(facts(event));
  return <>{translateText(eventPlace(facts(event)), locale)}{price && <> · {price.tone === 'free' ? <strong>{pick(price.text)}</strong> : pick(price.text)}</>}</>;
}

/**
 * ④ The rest of this weekend (1007 §4.2 ④, D9): a two-column cover feed of eight, the date on the photo, place and price
 * under it, the source check and ♡ 收藏 (FC3-02: the one save model, as on /events). One column at 大/特大 and in 简洁显示
 * on phones (FeedGrid). Ends with one button to the whole weekend.
 */
export function WeekendFeed({ feed, covers, tones, today, total }: { feed: readonly FeedEntry[]; covers: readonly ResolvedCover[]; tones: readonly (CoverTone | null)[]; today: string; total: number }) {
  const { t } = useUiCopy();
  const { layout } = useFeedLayout();
  if (!feed.length) return null;
  return <section className="home-feed" aria-labelledby="home-feed-title">
    <div className="home-section-head"><h2 id="home-feed-title">{t('本周末还有', 'More this weekend')}</h2></div>
    <FeedGrid label={t('本周末活动', 'Events this weekend')} layout={layout}>
      {feed.map(({ event, date }, index) => <FeedItem key={event.id}>
        <FeedCard title={event.title} to={`/events/${event.id}`}
          cover={<EventCover event={facts(event)} cover={covers[index]} tone={tones[index] ?? undefined} today={today} days={[date]} decorative />}
          meta={<EventMeta event={event} />} trust={<>{t('官网核对', 'Source checked')} {monthDay(event.verifiedAt)}</>}
          save={<SaveToWeek favorite={{ kind: 'event', id: event.id }} compact title={event.title} />} />
      </FeedItem>)}
    </FeedGrid>
    {total > feed.length && <Button variant="secondary" block to="/events" className="home-feed__all">
      {t(`看本周末全部 ${total} 场`, `See all ${total} events this weekend`)}
    </Button>}
  </section>;
}
