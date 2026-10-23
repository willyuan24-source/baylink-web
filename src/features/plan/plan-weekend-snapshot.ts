import { getCover } from '../../lib/cover';
import { leadImageKey } from '../../lib/close-up-faces';
import type { GuideImage } from '../../data/guide-media';
import { translateText } from '../../i18n/locale';
import { eventPlace, type EventFactsInput } from '../../lib/event-facts';
import { GUIDE_IMAGES, HOME_WEEKENDS, type HomeEvent } from '../../lib/home-catalog';
import { getHomeWeekend } from '../../lib/home-weekend';

/**
 * 行程's 本周末精选 (H54), generated with the home catalog (scripts/generate-plan-weekend.ts → src/data/generated/
 * plan-weekend.json): for each day the home has a weekend snapshot, the cards 行程 shows that day — the home's picks, then
 * its weekend list, the same order as on the home page (getHomeWeekend) — with those events, their English (the page loads
 * only the UI pack at first, never the home's) and their images. A few KB, so /plan does not load the home catalog and the
 * home page keeps its catalog in its own chunk. The first card is the home's lead (home-weekend-build.ts), so it shows what
 * a lead slot shows (lib/lead-rule.ts, UI-9 DECISIONS 32): a photograph, never a poster, a flyer or a close-up.
 */
export const PLAN_WEEKEND_SHOWN = 4;

/** A record's fields no /plan card reads (EventFactsInput and the cover): left out, as /plan's route JS is tight (UI9-R2). */
const UNREAD = ['region', 'verifiedAt'] as const;
export type PlanWeekendEvent = Omit<HomeEvent, typeof UNREAD[number]> & { en: { title: string; shortTitle?: string; place: string } };
export type PlanWeekendDay = { start: string; end: string; entries: { id: string; date: string }[] };
export type PlanWeekendSnapshot = { days: Record<string, PlanWeekendDay>; events: Record<string, PlanWeekendEvent>; images: Record<string, GuideImage> };

const HAN = /[㐀-鿿]/u;

/** Builds the snapshot from the home catalog. The caller has loaded the English dictionary (loadLocale('en')). */
export function buildPlanWeekend(): PlanWeekendSnapshot {
  const days: Record<string, PlanWeekendDay> = {};
  const events: Record<string, PlanWeekendEvent> = {};
  const images: Record<string, GuideImage> = {};
  // An event that is some day's first card keeps the lead slot's picture on every day (one record per event).
  const leads = new Set<string>();
  for (const day of Object.keys(HOME_WEEKENDS).sort()) {
    const weekend = getHomeWeekend(day);
    const entries = [...weekend.picks, ...weekend.feed].slice(0, PLAN_WEEKEND_SHOWN);
    days[day] = { start: weekend.start, end: weekend.end, entries: entries.map(entry => ({ id: entry.event.id, date: entry.date })) };
    entries.slice(0, 1).forEach(({ event }) => leads.add(event.id));
  }
  for (const day of Object.keys(HOME_WEEKENDS).sort()) {
    const weekend = getHomeWeekend(day);
    const entries = [...weekend.picks, ...weekend.feed].slice(0, PLAN_WEEKEND_SHOWN);
    for (const { event: item } of entries) {
      const event = item as HomeEvent;
      if (!events[event.id]) {
        const shortTitle = event.shortTitle ? translateText(event.shortTitle, 'en') : '';
        const card = Object.fromEntries(Object.entries(event).filter(([key]) => !(UNREAD as readonly string[]).includes(key))) as Omit<HomeEvent, typeof UNREAD[number]>;
        events[event.id] = { ...card, en: { title: translateText(event.title, 'en'), ...(shortTitle && !HAN.test(shortTitle) ? { shortTitle } : {}), place: translateText(eventPlace(event as unknown as EventFactsInput), 'en') } };
      }
      // The first candidate the ladder accepts (imageKeys: ① own, ② venue, ③ stock, ④ approved AI; UI9-IMG-A1b), so a pick
      // whose own image is no cover still shows a picture (never an information card); a second one only for a ③ picture,
      // so two picks of one category can show two pictures (/plan route JS ≤ the 0d5f7cd base, DECISIONS 28). The first
      // card takes what a lead slot takes: not its own close-up or posed group (leadImageKey) and a photograph only (`lead`:
      // no poster or flyer), so on a weekend whose picks have none it shows the pick's next candidate.
      const order = event.imageKeys ?? (event.imageKey ? [event.imageKey] : []);
      const accept = (keys: readonly string[], lead: boolean) => keys.filter(key => GUIDE_IMAGES[key]
        && getCover({ kind: 'event', id: event.id, imageKey: key, ...(lead ? { lead } : {}) }, { images: GUIDE_IMAGES, today: day }).tier !== 'type');
      const asLead = leads.has(event.id) ? accept(order.filter(key => key !== event.imageKey || leadImageKey(key)), true) : [];
      const accepted = asLead.length ? asLead : accept(order, false);
      const first = accepted[0] && getCover({ kind: 'event', id: event.id, imageKey: accepted[0] }, { images: GUIDE_IMAGES, today: day });
      const shown = accepted.slice(0, first && first.tier === 'stock' ? 2 : 1);
      // The strip's covers are decorative (alt=""; the card's title names the event) and 本页图片来源 reads the credit, not
      // the alt text, so the record ships without it: /plan's route JS is tight (UI9-R2 batch 1).
      for (const key of shown) images[key] = { ...GUIDE_IMAGES[key], alt: '' };
      if (event.imageKeys) events[event.id] = { ...events[event.id], imageKeys: shown };
    }
  }
  return { days, events, images };
}
