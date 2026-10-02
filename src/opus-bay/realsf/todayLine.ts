import type { Bilingual, Catalog } from '../core/types';
import { getCatalog } from '../data/catalog';
import { bayNow, bayParts } from '../game/bayNow';
import { EVENT_SAY, VENUE_SAY } from './eventVenues';
import { weekEvents } from './events';
import { sunHm, sunTimes } from './sun';

/**
 * Wave 5 · lane R (W5-R4) · one short line about San Francisco today (zh ≤ 45 characters): BAYBAY's addition to lane C's
 * welcome back (game/welcome.ts onWelcome 'returning') and the header of lane E's notebook (plan §3.5: "today's real SF
 * line"). Today's event in the world first, else the sunset, else the daily three.
 *
 *   todayLine(now?, catalog?)   今天金门公园有蓝草音乐节，旅行本「今天」里有～ · 今天旧金山日落 18:47，旅行本「今天」里有三件小事～
 */

const cut = (zh: string, alt: string) => ([...zh].length <= 45 ? zh : alt);

export function todayLine(now: Date = bayNow(), catalog: Catalog | null = getCatalog()): Bilingual {
  const day = bayParts(now).dateKey;
  const w = weekEvents(now, 1, catalog).find(x => x.dateKey === day);
  if (w) {
    const place = VENUE_SAY[w.venue.id] ?? w.venue.name;
    const name = EVENT_SAY[w.event.id] ?? { zh: '活动', en: 'an event' };
    return {
      zh: cut(`今天${place.zh}有${name.zh}，旅行本「今天」里有～`, `今天${place.zh}有${name.zh}！`),
      // (W8-I, W8I-WS-1) a sentence never starts lowercase ('the Ferry Building has …'), and it is *on* a page
      en: `${place.en.charAt(0).toUpperCase()}${place.en.slice(1)} has ${name.en} today — it is on the journal's Today page.`,
    };
  }
  const sun = sunTimes(now);
  if (now.getTime() < sun.sunset.getTime()) {
    const t = sunHm(sun.sunset);
    return { zh: `今天旧金山日落 ${t}，旅行本「今天」里有三件小事～`, en: `Sunset in San Francisco today is at ${t}; three small things wait on the journal's Today page.` };
  }
  return { zh: '旅行本「今天」里有今日三件小事，慢慢逛～', en: 'Three small things for today wait on the journal’s Today page — no rush.' };
}
