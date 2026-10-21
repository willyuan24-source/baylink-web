import type { ComponentProps, ReactNode } from 'react';
import { Cover, PendingCover, type CoverLayout, type CoverSlot } from './CoverImage';
import { useUiCopy } from './ui-copy';
import { eventDateChip, eventWhenLine, type EventFactsInput } from '../../lib/event-facts';
import { EventTypeCover as DateFamily } from './cover-date-face';
import { deferredFamily } from './deferred-family';

export { DateFace, type DateFaceProps } from './cover-date-face';

const DateFrame = (props: CoverLayout) => <PendingCover {...props} family="date" />;
// Production loads the date family after the page (UI9-IMG-A0: the info cards are on their way out, DECISIONS 21, and the
// home route had about 3.9 KiB left): this module starts the chunk as it loads, /events and /calendar wait for it in their
// `prepare`, and the prerendered pages that draw it preload it, so the first render has it. Node (the prerender and the
// tests) and the dev server draw it at once.
// (Both branches name the family, so the production build folds the condition and drops the static import.)
const deferred = import.meta.env?.PROD ? deferredFamily(() => import('./cover-date-face').then(module => module.EventTypeCover), DateFrame)
  : { Family: DateFamily, preload: () => Promise.resolve() };
/** Loads the date family's chunk (a route's `prepare` awaits it); resolved at once where the family is drawn directly. */
// eslint-disable-next-line react-refresh/only-export-components
export const preloadDateFamily = (): Promise<unknown> => deferred.preload();
void preloadDateFamily();

/**
 * Family date (events): the venue, the calendar page (weekday, day, time) and, when the page shows one day with one
 * structured window, the 6–24 h bar (G20); cover-date-face.tsx draws it. Until it is in, the same box and ground.
 */
export const EventTypeCover = (props: ComponentProps<typeof DateFamily>) => <Family {...props} />;
const Family: (props: ComponentProps<typeof DateFamily>) => ReactNode = deferred.Family;

/** An event cover: its photo or poster, or the date family. */
export function EventCover({ event, today, days, ...slot }: CoverSlot & { event: EventFactsInput; today: string; days?: readonly string[] }) {
  const chip = eventDateChip(event, today, days);
  return <Cover {...slot} kind="event" ended={chip.kind === 'day' && chip.ended}
    fallback={<EventTypeCover event={event} today={today} days={days} ratio={slot.ratio} ratioLock={slot.ratioLock} ariaHidden={slot.decorative} />} />;
}

/** Line 1 of an event card (G18): "周六 10/17 · 11:00–16:00" / "Sat, Oct 17 · 11am–4pm" (eventWhenLine). */
export function EventWhen({ event, today, days }: { event: Parameters<typeof eventWhenLine>[0]; today: string; days?: readonly string[] }) {
  const { pick } = useUiCopy();
  return <>{pick(eventWhenLine(event, today, days))}</>;
}
