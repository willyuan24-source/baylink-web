import { EventCover, EventWhen, FeedCard } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import { createCoverPage, getCover, type CoverPage } from '../../lib/cover';
import { eventPlace, eventPriceChip, type EventFactsInput } from '../../lib/event-facts';
import type { RailEvent } from './detail-record';

/** A rail card is 172 wide on a phone (the feed card's width) and a quarter of the column on a desktop. */
const RAIL_SIZES = '(max-width: 767px) 172px, 190px';

/** "Berkeley · 免费": the card's place and price line. */
function RailMeta({ event }: { event: RailEvent }) {
  const { pick, locale } = useUiCopy();
  const price = eventPriceChip(event as unknown as EventFactsInput);
  return <>{translateText(eventPlace(event), locale)}{price && <> · {pick(price.text)}</>}</>;
}

/**
 * Upcoming events beside a detail: "接下来可以去" on an ended event (on the first screen, EVT-11) and "附近同类活动的下一场"
 * at the end of a live one. Image-led feed cards (cover, title, place · price); a horizontal rail on a phone, a row of four
 * on a desktop. The hero's image is never repeated (page-level cover de-duplication). Renders nothing when no card is left.
 */
export function DetailRail({ id, title, note, cards, today, page }: { id: string; title: string; note?: string; cards: { event: RailEvent; date: string }[]; today: string; page?: CoverPage }) {
  if (!cards.length) return null;
  const claims = page ?? createCoverPage();
  const covers = cards.map(({ event }) => getCover({ kind: 'event', id: event.id, imageKey: event.imageKey }, { images: key => key === event.imageKey ? event.image : undefined, today, page: claims }));
  return <section className="detail-rail" aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    {note && <p className="detail-rail__note">{note}</p>}
    <div className="detail-rail__track">
      {cards.map(({ event, date }, index) => {
        const facts = event as unknown as EventFactsInput;
        return <FeedCard key={event.id} title={event.title} to={`/events/${event.id}?date=${date}`}
          cover={<EventCover event={facts} cover={covers[index]} today={today} days={[date]} sizes={RAIL_SIZES} decorative />}
          when={<EventWhen event={facts} today={today} days={[date]} />} meta={<RailMeta event={event} />} />;
      })}
    </div>
  </section>;
}
