import type { MonthlyEvent } from '../data/monthly-types';
import { GUIDE_IMAGES } from '../data/guide-media';
import { WEEKEND_FLAGSHIP_IDS, WEEKEND_PICKS } from '../data/weekend-picks';
import { getHomeWeekend, weekendFeed, type HomeWeekendPick } from './home-weekend';
import { getListingImage } from './offer-media';
import { isRealPhotoImage, rankWeekendFallback } from './weekend-ranking';
import { listingImageKeys } from './cover-candidates';
import { leadsWithPicture } from './lead-rule';

// Build-time weekend selection for the home snapshot, the /weekly cards and
// their verifier, so the three cannot drift. Scripts and tests only: the photo
// check reads the full image catalog, which must stay out of the client bundle.
const ranking = {
  hasPhoto: (imageKey: string) => !!getListingImage(imageKey),
  hasRealPhoto: (imageKey: string) => isRealPhotoImage(getListingImage(imageKey)),
  flagships: WEEKEND_FLAGSHIP_IDS,
};

/** Whether the event can lead (lib/lead-rule.ts: a ① or ② photograph) on the full registry, with its candidates (venue photos). */
export const buildCanLead = (event: MonthlyEvent, today: string) =>
  leadsWithPicture({ id: event.id, imageKey: event.imageKey, ...listingImageKeys('event', event) }, { images: GUIDE_IMAGES, today });

/**
 * The weekend as the home, the weekly card and their verifier see it. UI9-IMAGES DECISIONS 26 with UI-9 DECISIONS 32: the
 * lead (the first pick: the home's lead card, homeLeads[day] in the events index, the weekly card's first, /plan's first
 * pick) is the first pick in the editor's order whose picture is a ① or ② photograph (never a poster or flyer, a close-up
 * face, a posed group, an AI picture or an information card), and the picks before it follow it as normal cards; when no
 * pick has one, the next editor pick or the weekend's first in the ranking that has one leads and the last pick heads the
 * feed (the home's next card and /plan's fourth, never dropped from either). A weekend with no such picture anywhere keeps
 * its picks as they are (its lead slot draws its next candidate).
 */
export function getBuildWeekend(today: string, catalog: MonthlyEvent[], picksByWeekend = WEEKEND_PICKS) {
  const weekend = getHomeWeekend(today, catalog, { ...ranking, picks: picksByWeekend });
  const { picks, events, start } = weekend;
  const canLead = (event: MonthlyEvent) => buildCanLead(event, today);
  if (!picks.length || canLead(picks[0].event)) return weekend;
  const taken = new Set(picks.map(pick => pick.event.id));
  const list = picksByWeekend[start] ?? [];
  const ready = picks.find(pick => canLead(pick.event));
  const lead: HomeWeekendPick | undefined = ready
    ?? list.flatMap(({ id }, rank) => events.filter(entry => entry.event.id === id && !taken.has(id)).map(entry => ({ ...entry, editorial: { rank: rank + 1, reason: list[rank].reason } })))
      .find(entry => canLead(entry.event))
    ?? rankWeekendFallback(events.filter(entry => !taken.has(entry.event.id)), start, ranking).find(entry => canLead(entry.event));
  if (!lead) return weekend;
  const moved = [lead, ...picks.filter(pick => pick !== lead)];
  const kept = moved.slice(0, picks.length);
  return { ...weekend, picks: kept, feed: weekendFeed(events, kept, start, ranking, undefined, moved.slice(picks.length)) };
}
