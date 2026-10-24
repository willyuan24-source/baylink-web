import { EventCover, EventWhen, FeedCard, RowCard } from '../../components/ui';
import { MoreLink } from '../../components/ui/TextLink';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ResolvedCover } from '../../lib/cover';
import { eventPlace, eventPriceChip, type EventFactsInput } from '../../lib/event-facts';
import { checkedText, pressSource } from '../source-monitor/checked-line';
import type { RailCard, RailEvent } from './detail-record';

/** A rail card is 172 wide on a phone (the feed card's width) and a third (a quarter on an ended page) of the column on a desktop. */
const RAIL_SIZES = '(max-width: 767px) 172px, 260px';
/** At 特大 and in 简洁显示 the rail is a vertical list of at most this many rows, then 看全部活动 →. */
const ROWS = 3;

/** Line 2 (G18): the status and the place, "免费 · Berkeley"; it wraps and is never cut. */
function RailMeta({ event }: { event: RailEvent }) {
  const { pick, locale } = useUiCopy();
  const price = eventPriceChip(event as unknown as EventFactsInput);
  return <>{price && <>{pick(price.text)} · </>}{translateText(eventPlace(event), locale)}</>;
}

/**
 * Upcoming events beside a detail: "接下来可以去" on an ended event (on the first screen, EVT-11; up to four) and "附近同类活动的
 * 下一场" at the end of a live one (up to three). One card anatomy (owner decision 20): a 3:2 cover, the title at 600, line 1
 * eventWhenLine, line 2 status · place, then the ✓ 官网核对 line; nothing is ellipsised. A scroller on a phone (16 px scroll
 * padding, so the first card never sits at the edge), one row on a desktop (3-up, or 4-up for the ended page's four cards).
 * At 特大 and in 简洁显示 the same cards are a vertical list of row cards (CSS picks the list; both are in the markup so the
 * prerendered page is right in every reading mode), at most three, then 看全部活动 →. `hideInSimple`: 简洁显示 leaves the rail out
 * (the related rail; the ended page's 接下来可以去 is that page's content and stays). Renders nothing when no card is left.
 * `side` (B P04 / C P17): the desktop column's 附近还有, row cards only (at most three), under the sticky actions; a phone,
 * which reads the page's photo row instead, does not show it (local-discovery-detail.css).
 */
export function DetailRail({ id, title, note, cards, covers, today, hideInSimple, side }: { id: string; title: string; note?: string; cards: readonly RailCard[]; covers: readonly ResolvedCover[]; today: string; hideInSimple?: boolean; side?: boolean }) {
  const { t, locale } = useUiCopy();
  if (!cards.length) return null;
  return <section className={side ? 'detail-rail detail-rail--side' : 'detail-rail'} aria-labelledby={id} data-count={cards.length} data-simple={hideInSimple ? 'hide' : undefined}>
    <h2 id={id}>{title}</h2>
    {note && <p className="detail-rail__note">{note}</p>}
    {!side && <div className="detail-rail__track">
      {cards.map(({ event, date }, index) => {
        const facts = event as unknown as EventFactsInput;
        return <FeedCard key={event.id} title={event.title} to={`/events/${event.id}?date=${date}`} trust={checkedText(event.verifiedAt, pressSource(event.sourceLabel), locale, today)}
          cover={<EventCover event={facts} cover={covers[index]} today={today} days={[date]} sizes={RAIL_SIZES} ratio="3:2" ratioLock decorative />}
          when={<EventWhen event={facts} today={today} days={[date]} />} meta={<RailMeta event={event} />} />;
      })}
    </div>}
    <div className="detail-rail__rows">
      {cards.slice(0, ROWS).map(({ event, date }, index) => {
        const facts = event as unknown as EventFactsInput;
        return <RowCard key={event.id} title={event.title} to={`/events/${event.id}?date=${date}`} heading="h3"
          thumb={<EventCover event={facts} cover={covers[index]} today={today} days={[date]} sizes="112px" ratio="1:1" ratioLock decorative />}
          when={<EventWhen event={facts} today={today} days={[date]} />} meta={<RailMeta event={event} />} />;
      })}
      <MoreLink to="/events">{t('看全部活动', 'See all events')}</MoreLink>
    </div>
  </section>;
}
