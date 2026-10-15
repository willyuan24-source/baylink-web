import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { EventsView } from '../components/EventsView';
import { eventsViewMetadata, type EventsTitleView } from '../lib/monthly-metadata';
import { setPageMetadata } from '../lib/seo';
import { columnFor, resolveWhen } from '../features/events/events-model';

/**
 * /events (活动, 本周末 first). The prerender renders EventsView and links this chunk's stylesheet (features/events/events.css).
 * The title follows the view (H35): 今天 / 未来 7 天 / 十月 / 十一月 / 十二月 / 全部日期 / 免费与优惠 / 新店 each name themselves; 本周末 keeps the page's.
 */
export default function EventsPage() {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const column = columnFor(params, hash, false);
  // the list's own reading of ?when= (EventsShell's default 本周末), so 十月 / 十一月 / 十二月 / 全部日期 name what is on screen;
  // a new date choice in events-model's EventsWhen fails tsc here until VIEW_TITLES (monthly-metadata) gives it a title
  const view: EventsTitleView = column === 'perks' || column === 'openings' ? column : resolveWhen(params.get('when'), 'weekend');
  useEffect(() => setPageMetadata(eventsViewMetadata(view)), [view]);
  return <EventsView />;
}
