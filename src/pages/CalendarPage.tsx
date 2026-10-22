import { useEffect } from 'react';
import { EventsShell } from '../features/events/EventsShell';
import CalendarView from '../features/events/CalendarView';
import { CALENDAR_METADATA } from '../lib/calendar-metadata';
import { setPageMetadata } from '../lib/seo';
import { useLocale, type Locale } from '../i18n/locale';
import { loadForLocation } from '../features/events/events-later';

/** At boot (route-loaders.ts): /calendar?date= a day past the route's own weeks waits for the rest of the catalog. */
// eslint-disable-next-line react-refresh/only-export-components
export const prepare = (search: string, locale: Locale) => loadForLocation('calendar', search, locale);

/** /calendar (日历·地图): the events column's day view. Imported here so the prerender renders the week strip and the day's rows. */
export default function CalendarPage({ today }: { today?: string } = {}) {
  const locale = useLocale();
  useEffect(() => { setPageMetadata(CALENDAR_METADATA); }, [locale]);
  return <EventsShell today={today} calendar={day => <CalendarView today={day} />} />;
}
