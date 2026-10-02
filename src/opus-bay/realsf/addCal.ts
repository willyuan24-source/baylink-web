import type { CatalogEvent } from '../core/types';
import { importRetry } from '../game/importRetry';
import { track } from '../game/metrics';
import type { FreeItem } from './freeWeek';

/**
 * Wave 9 · lane R (W9-R3) · 「加到日历」's tap: the .ics builder (realsf/ics.ts) loads on the first tap, then the file is
 * saved (an event day, or a free day of an offer; a reminder the day before). Tiny on purpose: the event card, the
 * 这周免费 strip and the place cards import it.
 */
export function addToCalendar(item: FreeItem): void {
  // W9-S5 (lane S, surgical): the tap is a real action of review §9 (加日历 .ics) — the file is saved through an anchor
  // outside the game page, which the metrics runner's link listener never sees
  track('real', 'ics');
  void importRetry(() => import('./ics')).then(m => {
    if (item.kind === 'offer') m.downloadIcs(`baylink-${item.offer.id}-${item.day}`, m.offerIcs(item.offer, item.day, item.hours));
    else m.downloadIcs(`baylink-${item.event.id}-${item.day}`, m.eventIcs(item.event, item.day));
  }, () => undefined);
}

/** An event card's day. */
export const addEventToCalendar = (event: CatalogEvent, day: string) => addToCalendar({ kind: 'event', event, day });
