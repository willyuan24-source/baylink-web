import './events-page.css';
import { useEffect } from 'react';
import { EventsView } from '../components/EventsView';
import { EVENTS_METADATA } from '../lib/monthly-metadata';
import { setPageMetadata } from '../lib/seo';

/** /events (活动, 本周末 first). The prerender renders EventsView and links this chunk's stylesheet. */
export default function EventsPage() {
  useEffect(() => setPageMetadata(EVENTS_METADATA), []);
  return <EventsView />;
}
