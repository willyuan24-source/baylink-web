import type { LocalDiscovery } from '../data/local-discoveries';

/**
 * How long an ended listing stays visible to search (I18N-SEO-10): its page stays live for readers and old links, but it
 * leaves the sitemap a week after its last day and asks not to be indexed a month after.
 */
export const SITEMAP_ENDED_DAYS = 7;
export const NOINDEX_ENDED_DAYS = 30;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** Days since an event's or offer's last day; undefined while it runs, for a postponed event, or without a last day. */
export function listingEndedDaysAgo(item: LocalDiscovery, today: string): number | undefined {
  const last = item.kind === 'event' ? (item.event.status === 'postponed' ? undefined : item.event.endDate) : item.kind === 'offer' ? item.offer.endDate : undefined;
  return last && ISO_DAY.test(last) && last < today ? daysBetween(last, today) : undefined;
}
